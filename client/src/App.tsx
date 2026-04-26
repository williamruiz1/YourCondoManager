import type { CSSProperties, ReactNode } from "react";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { ChevronDown, LogOut } from "lucide-react";
import { Link, Route, Switch, useLocation } from "wouter";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { SiteFooter } from "@/components/site-footer";
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
import { BoardPortal } from "@/pages/board-portal";
import { GlobalCommandPalette } from "@/components/global-command-palette";
import { canAccessWipRoute } from "@/lib/wip-features";
import { trackPageView } from "@/lib/tracking";
import { MobileTabBar } from "@/components/mobile-tab-bar";
import { CookieConsentBanner } from "@/components/cookie-consent-banner";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useUserSettings, applyTheme, setAdminIdForSettings, formatSettingsDate } from "@/hooks/use-user-settings";
import { TrialBanner } from "@/components/trial-banner";
import { SubscriptionLockScreen } from "@/components/subscription-lock-screen";
import { ErrorBoundary } from "@/components/error-boundary";
import type { AdminRole } from "@shared/schema";

const LandingPage = lazy(() => import("@/pages/landing"));
const SolutionsPage = lazy(() => import("@/pages/solutions"));
const WorkspacePreviewPage = lazy(() => import("@/pages/workspace-preview"));
const DashboardPage = lazy(() => import("@/pages/dashboard"));
const OperationsDashboardPage = lazy(() => import("@/pages/operations-dashboard"));
const AssociationsPage = lazy(() => import("@/pages/associations"));
const AssociationContextPage = lazy(() => import("@/pages/association-context"));
const NewAssociationPage = lazy(() => import("@/pages/new-association"));
const UnitsPage = lazy(() => import("@/pages/units"));
const PersonsPage = lazy(() => import("@/pages/persons"));
const BoardPage = lazy(() => import("@/pages/board"));
const DocumentsPage = lazy(() => import("@/pages/documents"));
const RoadmapPage = lazy(() => import("@/pages/roadmap"));
const AdminUsersPage = lazy(() => import("@/pages/admin-users"));
const ExecutivePage = lazy(() => import("@/pages/executive"));
const FinancialFoundationPage = lazy(() => import("@/pages/financial-foundation"));
const FinancialRulesPage = lazy(() => import("@/pages/financial-rules"));
const FinancialPaymentsPage = lazy(() => import("@/pages/financial-payments"));
const FinancialReportsPage = lazy(() => import("@/pages/financial-reports"));
const FinancialBillingPage = lazy(() => import("@/pages/financial-billing"));
const FinancialExpensesPage = lazy(() => import("@/pages/financial-expenses"));
const GovernancePage = lazy(() => import("@/pages/governance"));
const VendorsPage = lazy(() => import("@/pages/vendors"));
const WorkOrdersPage = lazy(() => import("@/pages/work-orders"));
const MaintenanceSchedulesPage = lazy(() => import("@/pages/maintenance-schedules"));
const ResidentFeedbackPage = lazy(() => import("@/pages/resident-feedback"));
const InspectionsPage = lazy(() => import("@/pages/inspections"));
const MeetingsPage = lazy(() => import("@/pages/meetings"));
const GovernanceCompliancePage = lazy(() => import("@/pages/governance-compliance"));
const ElectionsPage = lazy(() => import("@/pages/elections"));
const ElectionDetailPage = lazy(() => import("@/pages/election-detail"));
const ElectionBallotPage = lazy(() => import("@/pages/election-ballot"));
const AiIngestionPage = lazy(() => import("@/pages/ai-ingestion"));
const CommunicationsPage = lazy(() => import("@/pages/communications"));
const CommunicationsInboxPage = lazy(() => import("@/pages/communications-inbox"));
const PlatformControlsPage = lazy(() => import("@/pages/platform-controls"));
// 3.5 Owner Portal Restructure — shell + zone files per /portal/*.
// owner-portal.tsx mega-file and standalone amenities.tsx were deleted in
// the cutover; their functionality is split across these zone files.
const PortalHomePage = lazy(() => import("@/pages/portal/portal-home"));
const PortalFinancesPage = lazy(() => import("@/pages/portal/portal-finances"));
const PortalRequestsPage = lazy(() => import("@/pages/portal/portal-requests"));
const PortalCommunityPage = lazy(() => import("@/pages/portal/portal-community"));
const PortalAmenitiesPage = lazy(() => import("@/pages/portal/portal-amenities"));
const PortalDocumentsPage = lazy(() => import("@/pages/portal/portal-documents"));
const PortalNoticesPage = lazy(() => import("@/pages/portal/portal-notices"));
const VendorPortalPage = lazy(() => import("@/pages/vendor-portal"));
const OnboardingInvitePage = lazy(() => import("@/pages/onboarding-invite"));
const InsurancePage = lazy(() => import("@/pages/insurance"));
const PortfolioPage = lazy(() => import("@/pages/portfolio"));
const AnnouncementsPage = lazy(() => import("@/pages/announcements"));
const PricingPage = lazy(() => import("@/pages/pricing"));
const PlanSignupPage = lazy(() => import("@/pages/plan-signup"));
const PlanSignupSuccessPage = lazy(() => import("@/pages/plan-signup-success"));
const PrivacyPolicyPage = lazy(() => import("@/pages/privacy-policy"));
const TermsOfServicePage = lazy(() => import("@/pages/terms-of-service"));
const UserSettingsPage = lazy(() => import("@/pages/user-settings"));
const SettingsBillingPage = lazy(() => import("@/pages/settings-billing"));
const HelpCenterPage = lazy(() => import("@/pages/help-center"));
const CommunityHubPage = lazy(() => import("@/pages/community-hub"));
const CommunityHubPublicPage = lazy(() => import("@/pages/community-hub-public"));
const AmenitiesAdminPage = lazy(() => import("@/pages/amenities-admin"));
const FinancialsHubPage = lazy(() => import("@/pages/hubs/financials-hub"));
const OperationsHubPage = lazy(() => import("@/pages/hubs/operations-hub"));
const GovernanceHubPage = lazy(() => import("@/pages/hubs/governance-hub"));
const CommunicationsHubPage = lazy(() => import("@/pages/hubs/communications-hub"));
const NotFound = lazy(() => import("@/pages/not-found"));
const AdminContextualFeedbackWidget = lazy(() => import("@/components/admin-contextual-feedback-widget").then((module) => ({ default: module.AdminContextualFeedbackWidget })));

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
      { label: "Buildings & Units", href: "/app/units", roles: ["platform-admin", "board-officer", "assisted-board", "pm-assistant", "manager"] },
      { label: "People", href: "/app/persons", roles: ["platform-admin", "board-officer", "assisted-board", "pm-assistant", "manager"] },
    ],
  },
  {
    id: "governance",
    matchPrefixes: ["/app/board", "/app/governance", "/app/communications", "/app/announcements"],
    testId: "tabs-governance-inpage",
    tabs: [
      { label: "Board Members", href: "/app/board", roles: ["platform-admin", "board-officer", "assisted-board", "pm-assistant", "manager", "viewer"] },
      { label: "Governance", href: "/app/governance", roles: ["platform-admin", "board-officer", "assisted-board", "pm-assistant", "manager", "viewer"] },
      { label: "Communications", href: "/app/communications", roles: ["platform-admin", "board-officer", "assisted-board", "pm-assistant", "manager", "viewer"] },
      { label: "Announcements", href: "/app/announcements", roles: ["platform-admin", "board-officer", "assisted-board", "pm-assistant", "manager"] },
    ],
  },
  {
    id: "finance",
    matchPrefixes: ["/app/financial/foundation", "/app/financial/billing", "/app/financial/rules", "/app/financial/payments", "/app/financial/expenses", "/app/financial/reports"],
    testId: "tabs-finance-inpage",
    tabs: [
      { label: "Chart of Accounts", href: "/app/financial/foundation", roles: ["platform-admin", "board-officer", "assisted-board", "pm-assistant", "manager"] },
      { label: "Billing", href: "/app/financial/billing", roles: ["platform-admin", "board-officer", "assisted-board", "pm-assistant", "manager", "viewer"] },
      { label: "Assessment Rules", href: "/app/financial/rules", roles: ["platform-admin", "board-officer", "assisted-board", "pm-assistant", "manager", "viewer"] },
      { label: "Payments", href: "/app/financial/payments", roles: ["platform-admin", "board-officer", "assisted-board", "pm-assistant", "manager"] },
      { label: "Expenses", href: "/app/financial/expenses", roles: ["platform-admin", "board-officer", "assisted-board", "pm-assistant", "manager"] },
      { label: "Reports", href: "/app/financial/reports", roles: ["platform-admin", "board-officer", "assisted-board", "pm-assistant", "manager", "viewer"] },
    ],
  },
  {
    id: "operations",
    matchPrefixes: ["/app/work-orders", "/app/vendors", "/app/resident-feedback", "/app/maintenance-schedules", "/app/inspections"],
    testId: "tabs-operations-inpage",
    tabs: [
      { label: "Work Orders", href: "/app/work-orders", roles: ["platform-admin", "board-officer", "assisted-board", "pm-assistant", "manager", "viewer"] },
      { label: "Maintenance", href: "/app/maintenance-schedules", roles: ["platform-admin", "board-officer", "assisted-board", "pm-assistant", "manager"] },
      { label: "Inspections", href: "/app/inspections", roles: ["platform-admin", "board-officer", "assisted-board", "pm-assistant", "manager"] },
      { label: "Vendors", href: "/app/vendors", roles: ["platform-admin", "board-officer", "assisted-board", "pm-assistant", "manager", "viewer"] },
      { label: "Feedback", href: "/app/resident-feedback", roles: ["platform-admin", "board-officer", "assisted-board", "pm-assistant", "manager", "viewer"] },
    ],
  },
  {
    id: "vendor-risk",
    matchPrefixes: ["/app/vendors", "/app/insurance"],
    testId: "tabs-vendor-risk-inpage",
    tabs: [
      { label: "Vendors", href: "/app/vendors", roles: ["platform-admin", "board-officer", "assisted-board", "pm-assistant", "manager", "viewer"] },
      { label: "Insurance Policies", href: "/app/insurance", roles: ["platform-admin", "board-officer", "assisted-board", "pm-assistant", "manager", "viewer"] },
    ],
  },
  {
    id: "platform",
    matchPrefixes: ["/app/platform/controls", "/app/admin", "/portal"],
    testId: "tabs-platform-inpage",
    tabs: [
      { label: "Platform Controls", href: "/app/platform/controls", roles: ["platform-admin"] },
      { label: "Admin Roadmap", href: "/app/admin/roadmap", matchPrefixes: ["/app/admin", "/app/admin/roadmap"], roles: ["platform-admin", "board-officer", "assisted-board", "pm-assistant"] },
      { label: "Executive", href: "/app/admin/executive", roles: ["platform-admin", "board-officer", "assisted-board", "pm-assistant"] },
      { label: "Admin Users", href: "/app/admin/users", roles: ["platform-admin"] },
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
  return (adminRole === "board-officer" || adminRole === "assisted-board") && associationCount <= 1;
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

// 5.2 (Wave 18) — per-zone ErrorBoundary wrapper. A render error in a single
// zone (Financials, Operations, Governance, Communications, Platform, Portal)
// renders <ErrorState> for that zone subtree only — the surrounding shell
// (sidebar, header, association switcher, trial banner) stays interactive.
// The root <ErrorBoundary> in App() still catches errors above the zone level.
function ZoneBoundary({ zone, children }: { zone: string; children: ReactNode }) {
  return (
    <ErrorBoundary
      title={`${zone} hit an error`}
      description={`We couldn't render the ${zone} surface. Try again, or navigate to another section while we recover.`}
    >
      {children}
    </ErrorBoundary>
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

        {/* ---------------------------------------------------------------
         * Phase 11 (3.2 — 61-route canonical table)
         * Hub URLs at the zone root per 1.2 Q4. Each hub is a navigation
         * surface (zone title, brief description, sub-page link list).
         * Per 3.2 Q5 there are NO /portal/* changes in this PR. Per the
         * scope boundary, NO <RouteGuard> wrappers ship in Phase 11 — they
         * land per-zone in Phases 12–16.
         * --------------------------------------------------------------- */}
        <Route path="/app/financials" component={FinancialsHubPage} />
        {/* 3.2 Q1 — plural-to-singular legacy redirects. These catch
            accidental plural deep-links without renaming the singular
            /app/financial/* subtree. */}
        <Route path="/app/financials/foundation"><RouteRedirect to="/app/financial/foundation" /></Route>
        <Route path="/app/financials/billing"><RouteRedirect to="/app/financial/billing" /></Route>
        <Route path="/app/financials/payments"><RouteRedirect to="/app/financial/payments" /></Route>
        <Route path="/app/financials/expenses"><RouteRedirect to="/app/financial/expenses" /></Route>
        <Route path="/app/financials/reports"><RouteRedirect to="/app/financial/reports" /></Route>

        <Route path="/app/operations" component={OperationsHubPage} />
        <Route path="/app/operations/dashboard" component={OperationsDashboardPage} />
        <Route path="/app/operations/records">
          <DocumentsPage typeFilter="Operations" />
        </Route>
        <Route path="/app/associations">
          {singleAssociationBoardExperience ? <RouteRedirect to="/app" /> : <AssociationsPage />}
        </Route>
        <Route path="/app/association-context" component={AssociationContextPage} />
        <Route path="/app/new-association" component={NewAssociationPage} />
        <Route path="/app/units" component={UnitsPage} />
        <Route path="/app/persons" component={PersonsPage} />
        <Route path="/app/owners">
          <RouteRedirect to="/app/persons" />
        </Route>
        <Route path="/app/occupancy">
          <RouteRedirect to="/app/units" />
        </Route>
        <Route path="/app/board" component={BoardPage} />
        <Route path="/app/documents">
          <DocumentsPage />
        </Route>
        {/* 3.2 Q6 — `/app/admin` alias retired. Hard 404 via the catch-all
            below. The previous `<Route path="/app/admin" component={RoadmapPage} />`
            declaration is intentionally removed; legitimate access to the
            roadmap goes through `/app/admin/roadmap`. */}
        <Route path="/app/admin/roadmap" component={RoadmapPage} />
        <Route path="/app/admin/users" component={AdminUsersPage} />
        <Route path="/app/admin/executive" component={ExecutivePage} />
        {/* Finance — consolidated routes (Wave 18: each wrapped in zone-scoped ErrorBoundary) */}
        <Route path="/app/financial/foundation"><ZoneBoundary zone="Financials"><FinancialFoundationPage /></ZoneBoundary></Route>
        <Route path="/app/financial/rules"><ZoneBoundary zone="Financials"><FinancialRulesPage /></ZoneBoundary></Route>
        <Route path="/app/financial/billing"><ZoneBoundary zone="Financials"><FinancialBillingPage /></ZoneBoundary></Route>
        <Route path="/app/financial/payments"><ZoneBoundary zone="Financials"><FinancialPaymentsPage /></ZoneBoundary></Route>
        <Route path="/app/financial/expenses"><ZoneBoundary zone="Financials"><FinancialExpensesPage /></ZoneBoundary></Route>
        <Route path="/app/financial/reports"><ZoneBoundary zone="Financials"><FinancialReportsPage /></ZoneBoundary></Route>
        {/* Finance — legacy redirects (3.2 Q4 archive — preserved verbatim) */}
        <Route path="/app/financial/fees"><RouteRedirect to="/app/financial/foundation" /></Route>
        <Route path="/app/financial/recurring-charges"><RouteRedirect to="/app/financial/foundation" /></Route>
        <Route path="/app/financial/ledger"><RouteRedirect to="/app/financial/billing" /></Route>
        <Route path="/app/financial/assessments"><RouteRedirect to="/app/financial/billing" /></Route>
        <Route path="/app/financial/late-fees"><RouteRedirect to="/app/financial/billing" /></Route>
        <Route path="/app/financial/invoices"><RouteRedirect to="/app/financial/expenses" /></Route>
        <Route path="/app/financial/utilities"><RouteRedirect to="/app/financial/expenses" /></Route>
        <Route path="/app/financial/budgets"><RouteRedirect to="/app/financial/expenses" /></Route>
        <Route path="/app/financial/reconciliation"><RouteRedirect to="/app/financial/reports" /></Route>
        {/* Operations — consolidated routes (Wave 18: zone-scoped ErrorBoundary) */}
        <Route path="/app/vendors"><ZoneBoundary zone="Operations"><VendorsPage /></ZoneBoundary></Route>
        <Route path="/app/work-orders"><ZoneBoundary zone="Operations"><WorkOrdersPage /></ZoneBoundary></Route>
        <Route path="/app/resident-feedback"><ZoneBoundary zone="Operations"><ResidentFeedbackPage /></ZoneBoundary></Route>
        <Route path="/app/maintenance-schedules"><ZoneBoundary zone="Operations"><MaintenanceSchedulesPage /></ZoneBoundary></Route>
        <Route path="/app/inspections"><ZoneBoundary zone="Operations"><InspectionsPage /></ZoneBoundary></Route>
        {/* 3.2 Q3 — Governance hub at zone root; legacy `GovernancePage`
            content relocated to `/app/governance/overview`. The existing
            governance legacy redirects continue to land at the new hub
            (which is the correct navigational entry point). */}
        <Route path="/app/governance/overview"><ZoneBoundary zone="Governance"><GovernancePage /></ZoneBoundary></Route>
        <Route path="/app/governance/elections/:id">{(params) => <ZoneBoundary zone="Governance"><ElectionDetailPage id={params.id ?? ""} /></ZoneBoundary>}</Route>
        <Route path="/app/governance/board-packages"><RouteRedirect to="/app/governance" /></Route>
        <Route path="/app/governance/meetings"><RouteRedirect to="/app/governance" /></Route>
        <Route path="/app/governance/compliance"><RouteRedirect to="/app/governance" /></Route>
        <Route path="/app/governance/elections"><RouteRedirect to="/app/governance" /></Route>
        <Route path="/app/governance"><ZoneBoundary zone="Governance"><GovernanceHubPage /></ZoneBoundary></Route>
        <Route path="/app/ai/ingestion">
          {canAccessWipRoute("/app/ai/ingestion", adminRole) ? <AiIngestionPage /> : <NotFound />}
        </Route>
        {/* 4.1 Wave 4 — central inbox must match BEFORE the generic
            /app/communications hub, since wouter resolves path literals
            in declaration order. (Wave 18: zone-scoped ErrorBoundary)
            Phase 11 (3.2 Q3) — Communications hub at zone root; legacy
            content relocated to `/app/communications/overview`. */}
        <Route path="/app/communications/inbox"><ZoneBoundary zone="Communications"><CommunicationsInboxPage /></ZoneBoundary></Route>
        <Route path="/app/communications/overview"><ZoneBoundary zone="Communications"><CommunicationsPage /></ZoneBoundary></Route>
        <Route path="/app/communications"><ZoneBoundary zone="Communications"><CommunicationsHubPage /></ZoneBoundary></Route>
        <Route path="/app/platform/controls">
          {adminRole === "platform-admin" ? <ZoneBoundary zone="Platform"><PlatformControlsPage /></ZoneBoundary> : <NotFound />}
        </Route>
        <Route path="/app/insurance" component={InsurancePage} />
        {/*
          [0.1 AC 9 — spec-locked] Board Officer / Assisted Board users (old
          board-admin role) with ≤1 association are redirected from Portfolio
          Health (/app/portfolio) to Home (/app). This is intentional per the
          0.1 decision: a single-association board member's action surface is
          Home, not the multi-association analytical view — Portfolio Health is
          designed for managers with multiple associations to compare. The
          single-association scenario has nothing meaningful to compare against,
          so landing on Home keeps the user on the action surface that serves
          them. Do NOT "fix" this as a bug. See
          docs/projects/platform-overhaul/decisions/0.1-dashboard-resolution.md.
        */}
        <Route path="/app/portfolio">
          {singleAssociationBoardExperience ? <RouteRedirect to="/app" /> : <PortfolioPage />}
        </Route>
        <Route path="/app/community-hub" component={CommunityHubPage} />
        <Route path="/app/amenities" component={AmenitiesAdminPage} />
        <Route path="/app/announcements" component={AnnouncementsPage} />
        <Route path="/app/help-center" component={HelpCenterPage} />
        {/* 4.4 Q6 (Wave 13) — Billing management entry point. Must match
            BEFORE /app/settings so wouter resolves the specific path first
            in declaration order. */}
        <Route path="/app/settings/billing" component={SettingsBillingPage} />
        <Route path="/app/settings" component={UserSettingsPage} />
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
        <Route path="/pricing">
          <PricingPage
            hasWorkspaceAccess={hasWorkspaceAccess}
            onStartGoogleSignIn={onStartGoogleSignIn}
          />
        </Route>
        <Route path="/solutions">
          <SolutionsPage
            hasWorkspaceAccess={hasWorkspaceAccess}
            onStartGoogleSignIn={onStartGoogleSignIn}
          />
        </Route>
        <Route path="/privacy-policy">
          <PrivacyPolicyPage
            hasWorkspaceAccess={hasWorkspaceAccess}
            onStartGoogleSignIn={onStartGoogleSignIn}
          />
        </Route>
        <Route path="/terms-of-service">
          <TermsOfServicePage
            hasWorkspaceAccess={hasWorkspaceAccess}
            onStartGoogleSignIn={onStartGoogleSignIn}
          />
        </Route>
        <Route path="/signup/success" component={PlanSignupSuccessPage} />
        <Route path="/signup" component={PlanSignupPage} />
        {/* 3.5 Owner Portal Restructure — Wave 11.
            PortalShell owns the session gate, sidebar, header, and
            breadcrumbs (Q3/Q4). Each zone file renders into the shell.
            Sub-pages under /portal/finances and /portal/requests mirror
            the /app/* sub-page pattern per Q1.
            Legacy-URL compat (Q8) is implemented inside PortalShell:
            `/portal?tab=<legacy>` → 301-equivalent client redirect. */}
        {/* (Wave 18: portal subtree wrapped in zone-scoped ErrorBoundary) */}
        <Route path="/portal">
          <ZoneBoundary zone="Portal"><PortalHomePage /></ZoneBoundary>
        </Route>
        <Route path="/portal/finances">
          <ZoneBoundary zone="Portal"><PortalFinancesPage /></ZoneBoundary>
        </Route>
        <Route path="/portal/finances/payment-methods">
          <ZoneBoundary zone="Portal"><PortalFinancesPage subPath="payment-methods" /></ZoneBoundary>
        </Route>
        <Route path="/portal/finances/ledger">
          <ZoneBoundary zone="Portal"><PortalFinancesPage subPath="ledger" /></ZoneBoundary>
        </Route>
        <Route path="/portal/finances/assessments/:assessmentId">
          {(params) => (
            <ZoneBoundary zone="Portal">
              <PortalFinancesPage subPath="assessment" assessmentId={params.assessmentId ?? ""} />
            </ZoneBoundary>
          )}
        </Route>
        <Route path="/portal/requests">
          <ZoneBoundary zone="Portal"><PortalRequestsPage /></ZoneBoundary>
        </Route>
        <Route path="/portal/requests/:requestId">
          {(params) => <ZoneBoundary zone="Portal"><PortalRequestsPage requestId={params.requestId ?? ""} /></ZoneBoundary>}
        </Route>
        <Route path="/portal/community">
          <ZoneBoundary zone="Portal"><PortalCommunityPage /></ZoneBoundary>
        </Route>
        <Route path="/portal/amenities">
          <ZoneBoundary zone="Portal"><PortalAmenitiesPage /></ZoneBoundary>
        </Route>
        <Route path="/portal/documents">
          <ZoneBoundary zone="Portal"><PortalDocumentsPage /></ZoneBoundary>
        </Route>
        <Route path="/portal/notices">
          <ZoneBoundary zone="Portal"><PortalNoticesPage /></ZoneBoundary>
        </Route>
        <Route path="/vendor-portal" component={VendorPortalPage} />
        <Route path="/vote/:token">
          {(params) => <ElectionBallotPage token={params.token ?? ""} />}
        </Route>
        <Route path="/community/:identifier" component={CommunityHubPublicPage} />
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
          <RouteRedirect to="/app/financial/foundation" />
        </Route>
        <Route path="/financial/assessments">
          <RouteRedirect to="/app/financial/billing" />
        </Route>
        <Route path="/financial/late-fees">
          <RouteRedirect to="/app/financial/billing" />
        </Route>
        <Route path="/financial/foundation">
          <RouteRedirect to="/app/financial/foundation" />
        </Route>
        <Route path="/financial/invoices">
          <RouteRedirect to="/app/financial/expenses" />
        </Route>
        <Route path="/financial/utilities">
          <RouteRedirect to="/app/financial/expenses" />
        </Route>
        <Route path="/financial/ledger">
          <RouteRedirect to="/app/financial/billing" />
        </Route>
        <Route path="/financial/budgets">
          <RouteRedirect to="/app/financial/expenses" />
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
          <RouteRedirect to="/app/governance" />
        </Route>
        <Route path="/maintenance-schedules">
          <RouteRedirect to="/app/maintenance-schedules" />
        </Route>
        <Route path="/inspections">
          <RouteRedirect to="/app/inspections" />
        </Route>
        <Route path="/governance/meetings">
          <RouteRedirect to="/app/governance" />
        </Route>
        <Route path="/governance/compliance">
          <RouteRedirect to="/app/governance" />
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

  const [, navigate] = useLocation();
  const userSettings = useUserSettings();
  const displayLabel = userSettings.displayName || accountEmail || "Signed in";
  const { data: thresholdAlerts = [] } = useQuery<{
    id: string;
    associationId: string;
    associationName: string;
    alertType: string;
    severity: "critical" | "warning" | "info";
    message: string;
    value: number;
    threshold: number;
  }[]>({
    queryKey: ["/api/portfolio/threshold-alerts"],
    enabled: !!authSession?.authenticated,
  });

  const criticalCount = thresholdAlerts.filter((a) => a.severity === "critical").length;
  const alertCount = thresholdAlerts.length;

  return (
    <div className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-2">
      <GlobalCommandPalette adminRole={adminRole} />
      {/* Notifications popover */}
      <Popover>
        <PopoverTrigger asChild>
          <button className="relative p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors" aria-label="Notifications">
            <span className="material-symbols-outlined text-[20px] text-slate-600 dark:text-slate-400">notifications</span>
            {alertCount > 0 && (
              <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 rounded-full bg-red-500 ring-2 ring-white dark:ring-slate-900 text-[10px] font-bold text-white flex items-center justify-center">
                {alertCount > 9 ? "9+" : alertCount}
              </span>
            )}
          </button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-80 p-0">
          <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <h4 className="text-sm font-semibold">Notifications</h4>
            {criticalCount > 0 && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                {criticalCount} critical
              </span>
            )}
          </div>
          <div className="max-h-72 overflow-y-auto">
            {alertCount === 0 ? (
              <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                <span className="material-symbols-outlined text-[28px] block mb-1 opacity-40">check_circle</span>
                No active alerts
              </div>
            ) : (
              thresholdAlerts.slice(0, 8).map((alert) => (
                <div
                  key={alert.id}
                  className="px-4 py-2.5 border-b border-slate-50 dark:border-slate-800/50 last:border-0 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer"
                  onClick={() => navigate("/app/portfolio")}
                >
                  <div className="flex items-start gap-2.5">
                    <span
                      className={`material-symbols-outlined text-[16px] mt-0.5 shrink-0 ${
                        alert.severity === "critical" ? "text-red-500" : alert.severity === "warning" ? "text-amber-500" : "text-blue-500"
                      }`}
                      style={{ fontVariationSettings: "'FILL' 1" }}
                    >
                      {alert.severity === "critical" ? "error" : alert.severity === "warning" ? "warning" : "info"}
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-foreground truncate">{alert.associationName}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{alert.message}</p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
          {alertCount > 0 && (
            <div className="px-4 py-2.5 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={() => navigate("/app/portfolio")}
                className="text-xs font-semibold text-primary hover:underline w-full text-center"
              >
                View all in Portfolio
              </button>
            </div>
          )}
        </PopoverContent>
      </Popover>
      {/* Settings — navigates to user settings */}
      <button
        className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        aria-label="Settings"
        onClick={() => navigate("/app/settings")}
      >
        <span className="material-symbols-outlined text-[20px] text-slate-600 dark:text-slate-400">settings</span>
      </button>
      <div className="w-px h-6 bg-slate-200 dark:bg-slate-700 mx-1 hidden sm:block" />
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
            <button
              className="h-8 w-8 rounded-full hover:ring-2 hover:ring-primary/20 transition-all"
              data-testid="button-account-menu"
            >
              <Avatar className="h-8 w-8">
                <AvatarFallback className="text-[11px] font-semibold bg-primary text-on-primary">
                  {getUserInitials(userSettings.displayName || accountEmail)}
                </AvatarFallback>
              </Avatar>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <DropdownMenuLabel className="space-y-1">
              <div className="truncate text-sm">{displayLabel}</div>
              {accountEmail && userSettings.displayName ? (
                <div className="text-xs font-normal text-muted-foreground truncate">{accountEmail}</div>
              ) : null}
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
    <div className="border-b bg-background/95 px-3 backdrop-blur" data-testid={activeGroup.testId}>
      <MobileTabBar
        items={visibleTabs.map((tab) => ({ id: tab.href, label: tab.label }))}
        value={visibleTabs.find((tab) => (tab.matchPrefixes ?? [tab.href]).some((prefix) => isTabActive(location, prefix)))?.href ?? visibleTabs[0].href}
        onChange={navigate}
        variant="tabular"
      />
    </div>
  );
}

const FINANCE_PARENT_TABS = [
  {
    label: "Chart of Accounts",
    href: "/app/financial/foundation",
    prefixes: ["/app/financial/foundation"],
  },
  {
    label: "Billing",
    href: "/app/financial/billing",
    prefixes: ["/app/financial/billing"],
  },
  {
    label: "Assessment Rules",
    href: "/app/financial/rules",
    prefixes: ["/app/financial/rules"],
  },
  {
    label: "Payments",
    href: "/app/financial/payments",
    prefixes: ["/app/financial/payments"],
  },
  {
    label: "Expenses",
    href: "/app/financial/expenses",
    prefixes: ["/app/financial/expenses"],
  },
  {
    label: "Reports",
    href: "/app/financial/reports",
    prefixes: ["/app/financial/reports"],
  },
];

const ALL_FINANCE_PREFIXES = FINANCE_PARENT_TABS.flatMap((t) => t.prefixes);

function FinanceParentTabBar() {
  const [location, navigate] = useLocation();
  const isFinancePage = ALL_FINANCE_PREFIXES.some((p) => location === p || location.startsWith(`${p}/`));

  if (!isFinancePage) return null;

  const activeParent =
    FINANCE_PARENT_TABS.find((tab) => tab.prefixes.some((p) => location === p || location.startsWith(`${p}/`)))
      ?.href ?? FINANCE_PARENT_TABS[0].href;

  return (
    <div className="sticky top-0 z-20 border-b bg-background/95 px-3 backdrop-blur">
      <MobileTabBar
        items={FINANCE_PARENT_TABS.map((tab) => ({ id: tab.href, label: tab.label }))}
        value={activeParent}
        onChange={navigate}
        variant="tabular"
      />
    </div>
  );
}

const OPERATIONS_PARENT_TABS = [
  {
    label: "Dashboard",
    href: "/app/operations/dashboard",
    prefixes: ["/app/operations/dashboard"],
  },
  {
    label: "Work Orders",
    href: "/app/work-orders",
    prefixes: ["/app/work-orders"],
  },
  {
    label: "Maintenance",
    href: "/app/maintenance-schedules",
    prefixes: ["/app/maintenance-schedules"],
  },
  {
    label: "Inspections",
    href: "/app/inspections",
    prefixes: ["/app/inspections"],
  },
  {
    label: "Vendors",
    href: "/app/vendors",
    prefixes: ["/app/vendors"],
  },
  {
    label: "Feedback",
    href: "/app/resident-feedback",
    prefixes: ["/app/resident-feedback"],
  },
];

const ALL_OPERATIONS_PREFIXES = OPERATIONS_PARENT_TABS.flatMap((t) => t.prefixes);

function OperationsParentTabBar() {
  const [location, navigate] = useLocation();
  const isOperationsPage = ALL_OPERATIONS_PREFIXES.some((p) => location === p || location.startsWith(`${p}/`));

  if (!isOperationsPage) return null;

  const activeParent =
    OPERATIONS_PARENT_TABS.find((tab) => tab.prefixes.some((p) => location === p || location.startsWith(`${p}/`)))
      ?.href ?? OPERATIONS_PARENT_TABS[0].href;

  return (
    <div className="sticky top-0 z-20 border-b bg-background/95 px-3 backdrop-blur">
      <MobileTabBar
        items={OPERATIONS_PARENT_TABS.map((tab) => ({ id: tab.href, label: tab.label }))}
        value={activeParent}
        onChange={navigate}
        variant="tabular"
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
      {/* 5.5 (Wave 21) — Skip-link for keyboard users. Visible on focus only;
          jumps over the sticky header and sidebar to the main content. The
          target id `main-content` is set on the <main> element below. */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-primary-foreground focus:shadow-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        data-testid="skip-to-content-workspace"
      >
        Skip to content
      </a>
      <main
        ref={mainRef}
        id="main-content"
        className="flex-1 overflow-auto"
        tabIndex={-1}
      >
        <div className="pb-[max(env(safe-area-inset-bottom),1rem)]">
          <WorkspaceRouter
            adminRole={adminRole}
            singleAssociationBoardExperience={singleAssociationBoardExperience}
          />
        </div>
        <SiteFooter />
      </main>
    </>
  );
}

type BillingSubscription = {
  status: string;
  plan: string;
  trialEndsAt?: string | null;
};

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

  const { data: billingData } = useQuery<BillingSubscription | { status: "none" }>({
    queryKey: ["/api/admin/billing/subscription"],
    enabled: !!authSession?.authenticated,
    staleTime: 5 * 60 * 1000,
  });

  const subscription = billingData && "plan" in billingData ? billingData : null;

  async function openBillingPortal() {
    try {
      const res = await fetch("/api/admin/billing/portal-session", {
        method: "POST",
        credentials: "include",
      });
      if (res.ok) {
        const { url } = await res.json();
        if (url) window.location.assign(url);
      }
    } catch { /* ignore */ }
  }

  const isLocked =
    subscription?.status === "canceled" ||
    subscription?.status === "unpaid";

  return (
    <AssociationProvider>
      <SidebarProvider style={style as CSSProperties}>
        <div className="flex h-screen w-full">
          <AppSidebar adminRole={adminRole} />
          <div className="flex min-w-0 flex-1 flex-col">
            {/* 5.3-F2 (Wave 18) — header compression on <640px:
                shorter row (h-12), tighter padding, no gap so the
                association switcher / account menu / palette fit. */}
            <header className="sticky top-0 z-40 flex h-12 min-h-12 flex-wrap items-center gap-1.5 border-b border-slate-200/50 dark:border-slate-800/50 glass-nav px-2 py-1.5 shadow-sm sm:h-16 sm:min-h-14 sm:gap-2 sm:px-3 sm:py-2">
              <SidebarTrigger data-testid="button-sidebar-toggle" />
              <HeaderActions
                authSession={authSession}
                adminRole={adminRole}
                onStartGoogleSignIn={onStartGoogleSignIn}
                onLogoutGoogleSession={onLogoutGoogleSession}
              />
            </header>
            {subscription?.status === "trialing" && (
              <TrialBanner
                trialEndsAt={subscription.trialEndsAt ?? null}
                plan={subscription.plan}
                onUpgrade={openBillingPortal}
              />
            )}
            <MainContent adminRole={adminRole} />
            {isLocked && (
              <SubscriptionLockScreen
                status={subscription!.status as "canceled" | "unpaid" | "past_due"}
                plan={subscription!.plan}
                trialEndsAt={subscription?.trialEndsAt}
                onManageBilling={openBillingPortal}
              />
            )}
          </div>
        </div>
      </SidebarProvider>
    </AssociationProvider>
  );
}

function AuthAwareApp() {
  const [location] = useLocation();
  const authRestoreAttemptedRef = useRef(false);

  useEffect(() => {
    trackPageView(document.title, { page_path: location });
  }, [location]);

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
      let detail = "";
      try { detail = await response.text(); } catch { /* ignore */ }
      console.warn(`[auth][restore] failed status=${response.status} body=${detail}`);
      throw new Error("restore-failed");
    }
    console.log("[auth][restore] session restored successfully");
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

  // ── User settings: sync admin id + apply theme on mount/change/navigation ──
  const userSettings = useUserSettings();
  useEffect(() => {
    if (authSession?.admin?.id) {
      setAdminIdForSettings(authSession.admin.id);
    }
  }, [authSession?.admin?.id]);
  // Re-apply theme whenever preference or route changes (dark mode is workspace-only)
  useEffect(() => {
    applyTheme(userSettings.theme);
  }, [userSettings.theme, location]);
  // Listen for system theme changes when set to "system"
  useEffect(() => {
    if (userSettings.theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => applyTheme("system");
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [userSettings.theme]);

  const adminRole = authSession?.admin?.role ?? null;
  const hasWorkspaceAccess = Boolean(authSession?.authenticated && authSession.admin);
  const isBoardMember = adminRole === "board-officer" || adminRole === "assisted-board";
  const isWorkspaceRoute = location === "/app" || location.startsWith("/app/");

  if (isWorkspaceRoute && authSessionLoading) {
    return <RouteFallback />;
  }

  // Board-member Google sign-in → show BoardPortal with session-based auth
  if (hasWorkspaceAccess && isBoardMember) {
    return (
      <AssociationProvider>
        <BoardMemberPortalShell onLogout={logoutGoogleSession} />
      </AssociationProvider>
    );
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
      {authSession?.admin?.role === "platform-admin" ? (
        <Suspense fallback={null}>
          <AdminContextualFeedbackWidget
            admin={{
              id: authSession.admin.id,
              email: authSession.admin.email,
            }}
          />
        </Suspense>
      ) : null}
    </>
  );
}

function BoardMemberPortalShell({ onLogout }: { onLogout: () => Promise<void> }) {
  const { activeAssociationId, associationResolved, associations } = useAssociationContext();

  if (!associationResolved || !activeAssociationId) {
    return <RouteFallback />;
  }

  const associationName = associations.find((a) => a.id === activeAssociationId)?.name;

  return (
    <BoardPortal
      associationId={activeAssociationId}
      associationName={associationName}
      onLogout={onLogout}
    />
  );
}

export default function App() {
  // 5.2 — wrap the authenticated app tree in an ErrorBoundary so that a
  // render error in a lazy-loaded route renders <ErrorState> instead of
  // a blank page. Placed below QueryClientProvider so a failing query
  // still has the provider available when a user hits Retry. Toaster +
  // CookieConsentBanner sit outside the boundary so they remain active
  // even during a render failure.
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <ErrorBoundary>
          <AuthAwareApp />
        </ErrorBoundary>
        <Toaster />
        <CookieConsentBanner />
      </TooltipProvider>
    </QueryClientProvider>
  );
}
