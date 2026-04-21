import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Building2,
  DoorOpen,
  Users,
  Home,
  UserCheck,
  FileText,
  AlertTriangle,
  Clock,
  ShieldAlert,
  BadgeDollarSign,
  Plus,
  Wrench,
  CalendarPlus,
  UserPlus,
  BookOpen,
  Sparkles,
  CheckCircle2,
  Circle,
  ChevronRight,
  Vote,
  Timer,
  ClipboardCheck,
} from "lucide-react";
import { SetupWizard } from "@/components/setup-wizard";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useAssociationContext } from "@/context/association-context";
import { WorkspacePageHeader } from "@/components/workspace-page-header";
import { AssociationScopeBanner } from "@/components/association-scope-banner";
import { AsyncStateBoundary } from "@/components/async-state-boundary";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";

interface DashboardStats {
  totalAssociations: number;
  totalUnits: number;
  totalOwners: number;
  totalTenants: number;
  totalBoardMembers: number;
  totalDocuments: number;
}

interface AssociationSummary {
  id: string;
  name: string;
  city: string;
  state: string;
}

interface DashboardAlerts {
  workOrders: {
    urgent: number;
    stalledOpen: number;
    totalOpen: number;
    items: Array<{ id: string; title: string; priority: string; status: string; associationId: string }>;
  };
  complianceTasks: {
    overdue: number;
    dueSoon: number;
    items: Array<{ id: string; title: string; dueDate: string | null; associationId: string }>;
  };
  vendorInsurance: {
    expired: number;
    dueSoon: number;
    items: Array<{ vendorId: string; vendorName: string; daysUntilExpiry: number; severity: string }>;
  };
  delinquentAccounts: {
    count: number;
  };
  orphanWarnings?: Array<{ type: string; message: string; count: number }>;
}

function StatCard({
  title,
  value,
  icon: Icon,
  description,
  loading,
  testId,
}: {
  title: string;
  value: number;
  icon: typeof Building2;
  description: string;
  loading: boolean;
  testId: string;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-8 w-16" />
        ) : (
          <div className="text-2xl font-bold" data-testid={testId}>
            {value}
          </div>
        )}
        <p className="text-xs text-muted-foreground mt-1">{description}</p>
      </CardContent>
    </Card>
  );
}

function AlertRow({
  icon: Icon,
  iconClass,
  label,
  count,
  sublabel,
  href,
}: {
  icon: typeof AlertTriangle;
  iconClass: string;
  label: string;
  count: number;
  sublabel: string;
  href: string;
}) {
  if (count === 0) return null;
  return (
    <div className="rounded-lg border bg-background p-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${iconClass}`}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <div className="text-sm font-medium">{label}</div>
          <div className="text-xs text-muted-foreground">{sublabel}</div>
        </div>
        </div>
        <div className="flex items-center justify-between gap-2 sm:justify-end">
          <Badge variant="destructive">{count}</Badge>
          <Button asChild size="sm" variant="outline">
            <Link href={href}>Review</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

interface ActiveElectionSummary {
  id: string;
  title: string;
  associationId: string;
  status: string;
  closesAt: string | null;
  eligibleVoterCount: number;
  castCount: number;
  participationPercent: number;
  quorumPercent: number;
  quorumMet: boolean;
}

function formatTimeRemaining(closesAt: string): string {
  const now = new Date();
  const closes = new Date(closesAt);
  const diffMs = closes.getTime() - now.getTime();
  if (diffMs <= 0) return "Closed";
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days}d ${hours % 24}h remaining`;
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  return `${hours}h ${minutes}m remaining`;
}

function ActiveElectionsCard({
  elections,
  loading,
}: {
  elections: ActiveElectionSummary[] | undefined;
  loading: boolean;
}) {
  const openElections = (elections ?? []).filter((e) => e.status === "open");

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Vote className="h-4 w-4" />
          Active Elections
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : openElections.length === 0 ? (
          <div className="text-center py-4">
            <Vote className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
            <p className="text-sm text-muted-foreground">No active elections</p>
          </div>
        ) : (
          <div className="space-y-3">
            {openElections.map((election) => (
              <Link key={election.id} href={`/app/governance/elections/${election.id}`}>
                <div className="rounded-lg border bg-background p-3 transition-colors hover:bg-muted/50">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium truncate">{election.title}</span>
                    <Badge
                      variant={election.quorumMet ? "default" : "outline"}
                      className="shrink-0 ml-2 text-xs"
                    >
                      {election.quorumMet ? "Quorum met" : "No quorum"}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3 mb-2">
                    <Progress value={election.participationPercent} className="h-2 flex-1" />
                    <span className="text-xs font-medium tabular-nums shrink-0">
                      {election.participationPercent}%
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>
                      {election.castCount} of {election.eligibleVoterCount} voted
                    </span>
                    {election.closesAt && (
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatTimeRemaining(election.closesAt)}
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

type AdminRole = "platform-admin" | "board-officer" | "assisted-board" | "pm-assistant" | "manager" | "viewer";

function QuickActions({
  activeAssociationId,
  onNewAssociation,
  adminRole,
}: {
  activeAssociationId: string | null;
  onNewAssociation: () => void;
  adminRole: AdminRole | null;
}) {
  const isViewer = adminRole === "viewer";
  const actions = [
    {
      label: "New Work Order",
      icon: Wrench,
      href: "/app/work-orders",
      disabled: !activeAssociationId || isViewer,
      title: isViewer ? "Read-only access" : (activeAssociationId ? undefined : "Select an association first"),
    },
    {
      label: "Schedule Meeting",
      icon: CalendarPlus,
      href: "/app/governance/meetings",
      disabled: !activeAssociationId || isViewer,
      title: isViewer ? "Read-only access" : (activeAssociationId ? undefined : "Select an association first"),
    },
    {
      label: "Invite Board Member",
      icon: UserPlus,
      href: "/app/board",
      disabled: !activeAssociationId || isViewer,
      title: isViewer ? "Read-only access" : (activeAssociationId ? undefined : "Select an association first"),
    },
    {
      label: "Post Ledger Entry",
      icon: BookOpen,
      href: "/app/financial/ledger",
      disabled: !activeAssociationId || isViewer,
      title: isViewer ? "Read-only access" : (activeAssociationId ? undefined : "Select an association first"),
    },
  ];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Quick Actions
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {actions.map((action) => (
            <Button
              key={action.label}
              asChild={!action.disabled}
              variant="outline"
              className="h-auto min-h-12 flex-col gap-1.5 py-3 text-xs"
              disabled={action.disabled}
              title={action.title}
            >
              {action.disabled ? (
                <span>
                  <action.icon className="h-4 w-4" />
                  {action.label}
                </span>
              ) : (
                <Link href={action.href}>
                  <action.icon className="h-4 w-4" />
                  {action.label}
                </Link>
              )}
            </Button>
          ))}
          <Button
            variant="outline"
            className="h-auto min-h-12 flex-col gap-1.5 py-3 text-xs"
            onClick={onNewAssociation}
          >
            <Building2 className="h-4 w-4" />
            New Association
          </Button>
        </div>
        {!activeAssociationId && (
          <p className="mt-2 text-xs text-muted-foreground">
            Select an association above to enable quick actions.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function AlertsPanel({
  alerts,
  loading,
  activeAssociationId,
  activeElections,
}: {
  alerts: DashboardAlerts | undefined;
  loading: boolean;
  activeAssociationId: string | null;
  activeElections?: ActiveElectionSummary[];
}) {
  const electionsClosingSoon = (activeElections ?? []).filter((e) => {
    if (e.status !== "open" || !e.closesAt) return false;
    const hoursLeft = (new Date(e.closesAt).getTime() - Date.now()) / (1000 * 60 * 60);
    return hoursLeft > 0 && hoursLeft <= 48;
  });

  const electionsAwaitingCertification = (activeElections ?? []).filter(
    (e) => e.status === "closed",
  );

  const totalAlerts =
    (alerts?.workOrders.urgent ?? 0) +
    (alerts?.workOrders.stalledOpen ?? 0) +
    (alerts?.complianceTasks.overdue ?? 0) +
    (alerts?.complianceTasks.dueSoon ?? 0) +
    (alerts?.vendorInsurance.expired ?? 0) +
    (alerts?.vendorInsurance.dueSoon ?? 0) +
    (alerts?.delinquentAccounts.count ?? 0) +
    (alerts?.orphanWarnings ?? []).reduce((sum, w) => sum + w.count, 0) +
    electionsClosingSoon.length +
    electionsAwaitingCertification.length;

  return (
    <div className="rounded-xl border bg-muted/10 p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold">Attention Required</div>
          <div className="text-xs text-muted-foreground">
            {activeAssociationId
              ? "Live alerts scoped to the selected association."
              : "Portfolio-wide alerts across all associations."}
          </div>
        </div>
        {!loading && totalAlerts > 0 && (
          <Badge variant="destructive" className="text-sm px-2">
            {totalAlerts}
          </Badge>
        )}
      </div>

      {loading ? (
        <div className="space-y-2">
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </div>
      ) : totalAlerts === 0 ? (
        <div className="rounded-lg border bg-background p-4 text-center">
          <div className="text-sm font-medium text-green-700 dark:text-green-400">All clear</div>
          <div className="mt-1 text-xs text-muted-foreground">
            No urgent work orders, overdue compliance tasks, or insurance alerts.
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <AlertRow
            icon={AlertTriangle}
            iconClass="bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400"
            label="Urgent work orders"
            count={alerts?.workOrders.urgent ?? 0}
            sublabel="Open work orders marked urgent — need immediate attention"
            href="/app/work-orders"
          />
          <AlertRow
            icon={Clock}
            iconClass="bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400"
            label="Stalled open work orders"
            count={alerts?.workOrders.stalledOpen ?? 0}
            sublabel="Work orders open for more than 7 days with no status update"
            href="/app/work-orders"
          />
          <AlertRow
            icon={AlertTriangle}
            iconClass="bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400"
            label="Overdue compliance tasks"
            count={alerts?.complianceTasks.overdue ?? 0}
            sublabel="Governance tasks past their due date"
            href="/app/governance/compliance"
          />
          <AlertRow
            icon={Clock}
            iconClass="bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400"
            label="Compliance tasks due in 14 days"
            count={alerts?.complianceTasks.dueSoon ?? 0}
            sublabel="Upcoming governance deadlines requiring action"
            href="/app/governance/compliance"
          />
          <AlertRow
            icon={ShieldAlert}
            iconClass="bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400"
            label="Vendors with expired insurance"
            count={alerts?.vendorInsurance.expired ?? 0}
            sublabel="Do not assign work orders until coverage is renewed"
            href="/app/vendors"
          />
          <AlertRow
            icon={ShieldAlert}
            iconClass="bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400"
            label="Vendor insurance expiring soon"
            count={alerts?.vendorInsurance.dueSoon ?? 0}
            sublabel="Insurance expiring within 30 days — request renewal certificates"
            href="/app/vendors"
          />
          {activeAssociationId && (
            <AlertRow
              icon={BadgeDollarSign}
              iconClass="bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400"
              label="Delinquent accounts"
              count={alerts?.delinquentAccounts.count ?? 0}
              sublabel="Owner accounts with outstanding balances"
              href="/app/financial/ledger"
            />
          )}
          {(alerts?.orphanWarnings ?? []).map((warning) => (
            <AlertRow
              key={warning.type}
              icon={AlertTriangle}
              iconClass="bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400"
              label="Data integrity warning"
              count={warning.count}
              sublabel={warning.message}
              href="/app/persons"
            />
          ))}
          {electionsClosingSoon.map((election) => (
            <div key={`closing-${election.id}`} className="rounded-lg border bg-background p-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400">
                    <Timer className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-medium">Election closing soon: {election.title}</div>
                    <div className="text-xs text-muted-foreground">
                      {election.closesAt ? formatTimeRemaining(election.closesAt) : ""} — {election.participationPercent}% participation
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-2 sm:justify-end">
                  <Badge variant="destructive">1</Badge>
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/app/governance/elections/${election.id}`}>Review</Link>
                  </Button>
                </div>
              </div>
            </div>
          ))}
          {electionsAwaitingCertification.map((election) => (
            <div key={`certify-${election.id}`} className="rounded-lg border bg-background p-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400">
                    <ClipboardCheck className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-medium">Election awaiting certification: {election.title}</div>
                    <div className="text-xs text-muted-foreground">
                      Voting closed — {election.participationPercent}% participation, {election.quorumMet ? "quorum met" : "quorum not met"}
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-2 sm:justify-end">
                  <Badge variant="destructive">1</Badge>
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/app/governance/elections/${election.id}`}>Certify</Link>
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

type AuthSession = { authenticated: boolean; admin?: { role: AdminRole } | null };

export default function DashboardPage() {
  useDocumentTitle("Home");
  const [wizardOpen, setWizardOpen] = useState(false);
  const { activeAssociationId, setActiveAssociationId } = useAssociationContext();
  const { data: authSession } = useQuery<AuthSession>({ queryKey: ["/api/auth/session"] });
  const adminRole: AdminRole | null = authSession?.admin?.role ?? null;

  const { data: stats, isLoading } = useQuery<DashboardStats>({
    queryKey: ["/api/dashboard/stats", activeAssociationId],
  });

  const { data: associations = [], isLoading: associationsLoading } = useQuery<AssociationSummary[]>({
    queryKey: ["/api/associations", activeAssociationId],
  });

  const alertsQueryKey = activeAssociationId
    ? [`/api/dashboard/alerts?associationId=${activeAssociationId}`]
    : ["/api/dashboard/alerts"];

  const { data: alerts, isLoading: alertsLoading } = useQuery<DashboardAlerts>({
    queryKey: alertsQueryKey,
  });

  const electionsQueryKey = activeAssociationId
    ? [`/api/elections/active-summary?associationId=${activeAssociationId}`]
    : ["/api/elections/active-summary"];

  const { data: activeElections, isLoading: electionsLoading } = useQuery<ActiveElectionSummary[]>({
    queryKey: electionsQueryKey,
  });

  const { data: onboardingState } = useQuery<{
    state: "not-started" | "in-progress" | "blocked" | "complete";
    scorePercent: number;
    remediationItems: Array<{ label: string; href: string; summary: string }>;
    components: {
      unitsConfigured: { score: number; total: number; completed: number };
      ownerDataCollected: { score: number; total: number; completed: number };
      boardMembersConfigured: { score: number; total: number; completed: number };
      paymentMethodsConfigured: { score: number; total: number; completed: number };
      communicationTemplatesConfigured: { score: number; total: number; completed: number };
    };
  }>({
    queryKey: [activeAssociationId ? `/api/onboarding/state?associationId=${activeAssociationId}` : null],
    enabled: Boolean(activeAssociationId),
  });

  const cards = [
    {
      title: "Associations",
      value: stats?.totalAssociations ?? 0,
      icon: Building2,
      description: "Active condo associations",
      testId: "stat-associations",
    },
    {
      title: "Units",
      value: stats?.totalUnits ?? 0,
      icon: DoorOpen,
      description: "Registered units",
      testId: "stat-units",
    },
    {
      title: "Owners",
      value: stats?.totalOwners ?? 0,
      icon: Users,
      description: "Property owners",
      testId: "stat-owners",
    },
    {
      title: "Tenants",
      value: stats?.totalTenants ?? 0,
      icon: Home,
      description: "Active tenants",
      testId: "stat-tenants",
    },
    {
      title: "Board Members",
      value: stats?.totalBoardMembers ?? 0,
      icon: UserCheck,
      description: "Active board members",
      testId: "stat-board",
    },
    {
      title: "Documents",
      value: stats?.totalDocuments ?? 0,
      icon: FileText,
      description: "Uploaded documents",
      testId: "stat-documents",
    },
  ];

  const noAssociations = !isLoading && (stats?.totalAssociations ?? 0) === 0;

  return (
    <div className="p-6 space-y-6">
      <SetupWizard
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        onAssociationCreated={(id) => setActiveAssociationId(id)}
      />

      <WorkspacePageHeader
        title="Dashboard"
        summary="Portfolio overview across all managed associations, with direct access into the current in-context workspace."
        eyebrow="Workspace"
        breadcrumbs={[{ label: "Dashboard" }]}
        shortcuts={[
          { label: "Open Association Context", href: "/app/association-context" },
          { label: "Review Documents", href: "/app/documents" },
        ]}
      />

      {noAssociations && (
        <div className="rounded-xl border-2 border-dashed border-primary/40 bg-primary/5 p-6">
          <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/10">
              <Sparkles className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1">
              <p className="font-semibold">Welcome — let's get your first association set up</p>
              <p className="text-sm text-muted-foreground mt-0.5">
                The setup wizard walks you through creating your association, adding units, configuring your HOA fee, and adding a board member — all in about 5 minutes.
              </p>
            </div>
            <Button onClick={() => setWizardOpen(true)} className="shrink-0">
              <Sparkles className="mr-2 h-4 w-4" />
              Start Setup
            </Button>
          </div>
        </div>
      )}

      {adminRole === "viewer" && (
        <div className="rounded-lg border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
          You have <span className="font-medium text-foreground">viewer</span> access — create and edit actions are disabled. Contact your administrator to request elevated permissions.
        </div>
      )}

      <AssociationScopeBanner
        activeAssociationId={activeAssociationId}
        activeAssociationName={associations?.find((a) => a.id === activeAssociationId)?.name ?? ""}
        explanation={
          activeAssociationId
            ? "The selected association controls in-context pages, filtered records, and create actions across the admin workspace."
            : "Select an association to move from portfolio oversight into a scoped operating workspace."
        }
      />

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => (
          <StatCard key={card.title} {...card} loading={isLoading} />
        ))}
      </div>

      <QuickActions activeAssociationId={activeAssociationId} onNewAssociation={() => setWizardOpen(true)} adminRole={adminRole} />

      <ActiveElectionsCard elections={activeElections} loading={electionsLoading} />

      {activeAssociationId && onboardingState && onboardingState.state !== "complete" && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-primary" />
                Association Setup
              </CardTitle>
              <div className="flex items-center gap-2 self-start sm:self-auto">
                <div className="text-sm font-medium">{onboardingState.scorePercent}%</div>
                <div className="w-24 h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${onboardingState.scorePercent}%` }}
                  />
                </div>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Complete these steps to fully configure your association.
            </p>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-1">
              {[
                { label: "Units configured", done: onboardingState.components.unitsConfigured.completed > 0, href: "/app/units" },
                { label: "Owner data collected", done: onboardingState.components.ownerDataCollected.total === onboardingState.components.ownerDataCollected.completed, href: "/app/association-context" },
                { label: "Board members configured", done: onboardingState.components.boardMembersConfigured.completed > 0, href: "/app/board" },
                { label: "Payment methods configured", done: onboardingState.components.paymentMethodsConfigured.completed > 0, href: "/app/financial/foundation" },
                { label: "Communication templates configured", done: onboardingState.components.communicationTemplatesConfigured.completed > 0, href: "/app/communications" },
              ].map((step) => (
                <Link key={step.label} href={step.href}>
                  <div className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors hover:bg-muted/50 ${step.done ? "text-muted-foreground" : ""}`}>
                    {step.done
                      ? <CheckCircle2 className="h-4 w-4 shrink-0 text-green-500" />
                      : <Circle className="h-4 w-4 shrink-0 text-muted-foreground" />
                    }
                    <span className={step.done ? "line-through" : "font-medium"}>{step.label}</span>
                    {!step.done && <ChevronRight className="h-3 w-3 ml-auto text-muted-foreground" />}
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <AlertsPanel
        alerts={alerts}
        loading={alertsLoading}
        activeAssociationId={activeAssociationId}
        activeElections={activeElections}
      />

      <AsyncStateBoundary
        isLoading={associationsLoading}
        isEmpty={!associationsLoading && associations.length === 0}
        emptyTitle="No associations yet"
        emptyMessage="Create an association before using the portfolio workspace."
      >
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Associations</CardTitle>
            <Button asChild size="sm" variant="outline">
              <Link href="/app/associations">Manage Associations</Link>
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {associations.slice(0, 5).map((association) => (
                <div key={association.id} className="rounded-md border p-3">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{association.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {association.city}, {association.state}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant={association.id === activeAssociationId ? "default" : "outline"}
                    onClick={() => setActiveAssociationId(association.id)}
                    data-testid={`button-set-dashboard-context-${association.id}`}
                    className="self-start sm:self-auto"
                  >
                    {association.id === activeAssociationId ? "In Context" : "Use Context"}
                  </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </AsyncStateBoundary>

      {activeAssociationId ? (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Current Association Context</CardTitle>
            <Button asChild size="sm" variant="outline">
              <Link href="/app/association-context">Open In-Context View</Link>
            </Button>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Portfolio stays here on the dashboard. Use the in-context view for the selected association's overview,
            documents, buildings, units, ownership, and occupancy workflow.
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
