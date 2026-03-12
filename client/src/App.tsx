import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { Switch, Route } from "wouter";
import { Link, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AssociationProvider, useAssociationContext } from "@/context/association-context";

const DashboardPage = lazy(() => import("@/pages/dashboard"));
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
const MeetingsPage = lazy(() => import("@/pages/meetings"));
const GovernanceCompliancePage = lazy(() => import("@/pages/governance-compliance"));
const AiIngestionPage = lazy(() => import("@/pages/ai-ingestion"));
const CommunicationsPage = lazy(() => import("@/pages/communications"));
const PlatformControlsPage = lazy(() => import("@/pages/platform-controls"));
const OwnerPortalPage = lazy(() => import("@/pages/owner-portal"));
const NotFound = lazy(() => import("@/pages/not-found"));

function Router() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Switch>
        <Route path="/" component={DashboardPage} />
        <Route path="/associations" component={AssociationsPage} />
        <Route path="/association-context" component={AssociationContextPage} />
        <Route path="/units" component={UnitsPage} />
        <Route path="/persons" component={PersonsPage} />
        <Route path="/owners" component={OwnersPage} />
        <Route path="/occupancy" component={OccupancyPage} />
        <Route path="/board" component={BoardPage} />
        <Route path="/documents" component={DocumentsPage} />
        <Route path="/roadmap" component={RoadmapPage} />
        <Route path="/admin" component={RoadmapPage} />
        <Route path="/admin/roadmap" component={RoadmapPage} />
        <Route path="/admin/users" component={AdminUsersPage} />
        <Route path="/admin/executive" component={ExecutivePage} />
        <Route path="/financial/fees" component={FinancialFeesPage} />
        <Route path="/financial/assessments" component={FinancialAssessmentsPage} />
        <Route path="/financial/late-fees" component={FinancialLateFeesPage} />
        <Route path="/financial/foundation" component={FinancialFoundationPage} />
        <Route path="/financial/invoices" component={FinancialInvoicesPage} />
        <Route path="/financial/utilities" component={FinancialUtilitiesPage} />
        <Route path="/financial/ledger" component={FinancialLedgerPage} />
        <Route path="/financial/budgets" component={FinancialBudgetsPage} />
        <Route path="/financial/payments" component={FinancialPaymentsPage} />
        <Route path="/governance/meetings" component={MeetingsPage} />
        <Route path="/governance/compliance" component={GovernanceCompliancePage} />
        <Route path="/ai/ingestion" component={AiIngestionPage} />
        <Route path="/communications" component={CommunicationsPage} />
        <Route path="/platform/controls" component={PlatformControlsPage} />
        <Route path="/portal" component={OwnerPortalPage} />
        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

function RouteFallback() {
  return (
    <div className="flex h-full min-h-[240px] items-center justify-center px-6">
      <div className="text-sm text-muted-foreground">Loading view...</div>
    </div>
  );
}

function App() {
  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AssociationProvider>
          <SidebarProvider style={style as React.CSSProperties}>
            <div className="flex h-screen w-full">
              <AppSidebar />
              <div className="flex flex-col flex-1 min-w-0">
                <header className="flex items-center justify-between gap-2 p-2 border-b h-12">
                  <SidebarTrigger data-testid="button-sidebar-toggle" />
                  <HeaderActions />
                </header>
                <MainContent />
              </div>
            </div>
          </SidebarProvider>
        </AssociationProvider>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

function HeaderActions() {
  const { associations, activeAssociationId, setActiveAssociationId } = useAssociationContext();
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
  const { data: authMe, refetch: refetchAuthMe } = useQuery<{ authenticated: boolean; user?: { email?: string } } | null>({
    queryKey: ["/api/auth/me", "header"],
    queryFn: async () => {
      const res = await fetch("/api/auth/me", { credentials: "include" });
      if (res.status === 401) return null;
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
  });

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
      refetchAuthMe();
      window.location.reload();
    }
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [refetchAuthMe]);

  useEffect(() => {
    if (authMe?.authenticated) return;
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
        await refetchAuthMe();
        queryClient.invalidateQueries();
      })
      .catch(() => {
        window.localStorage.removeItem("authRestorePayload");
      });
  }, [authMe, refetchAuthMe]);

  function startGoogleSignIn(forceSelect = false) {
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
      refetchAuthMe();
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
      await refetchAuthMe();
    }
  }

  return (
    <div className="flex items-center gap-2">
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
      <Dialog open={authOpen} onOpenChange={setAuthOpen}>
        <DialogTrigger asChild>
          <Button size="sm" variant={adminAuthConfigured ? "outline" : "default"} data-testid="button-open-admin-auth">
            {adminAuthConfigured ? "Admin Auth" : "Set Admin Auth"}
          </Button>
        </DialogTrigger>
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
                onChange={(event) => setAdminApiKey(event.target.value)}
                placeholder="Enter ADMIN_API_KEY value"
                data-testid="input-admin-api-key"
              />
            </div>
            <div className="grid gap-1">
              <Label htmlFor="admin-user-email">Admin User Email</Label>
              <Input
                id="admin-user-email"
                value={adminUserEmail}
                onChange={(event) => setAdminUserEmail(event.target.value)}
                placeholder="admin@example.com"
                data-testid="input-admin-user-email"
              />
            </div>
            <Button onClick={saveAdminAuth} data-testid="button-save-admin-auth">Save</Button>
          </div>
        </DialogContent>
      </Dialog>
      <Button size="sm" variant={authMe?.authenticated ? "outline" : "default"} onClick={() => startGoogleSignIn(true)} data-testid="button-google-signin">
        {authMe?.authenticated ? `Google: ${authMe.user?.email || "Signed in"}` : "Sign in with Google"}
      </Button>
      {authMe?.authenticated ? (
        <Button size="sm" variant="outline" onClick={logoutGoogleSession} data-testid="button-google-signout">
          Sign out
        </Button>
      ) : null}
      <Button asChild size="sm" data-testid="button-open-admin-roadmap-global">
        <Link href="/admin/roadmap">Admin Roadmap</Link>
      </Button>
    </div>
  );
}

function AdminPageTabs() {
  const [location] = useLocation();

  const tabs = [
    { label: "Roadmap", href: "/admin/roadmap", isActive: location === "/roadmap" || location === "/admin" || location === "/admin/roadmap" },
    { label: "Executive", href: "/admin/executive", isActive: location === "/admin/executive" },
    { label: "Admin Users", href: "/admin/users", isActive: location === "/admin/users" },
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
    location === "/roadmap" ||
    location === "/admin" ||
    location === "/admin/roadmap" ||
    location === "/admin/executive" ||
    location === "/admin/users";

  return (
    <>
      {showAdminTabs ? <AdminPageTabs /> : null}
      <main className="flex-1 overflow-auto">
        <Router />
      </main>
    </>
  );
}

export default App;
