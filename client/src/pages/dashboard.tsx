// zone: Home
// persona: Manager, Board Officer, Assisted Board, PM Assistant, Platform Admin
//
// YCM Redesign M1 (founder-os#10190) — Manager Dashboard restyled onto the
// shared @ycm/design-system (F1, founder-os#10187). Presentation is lifted to
// the deep-teal design system primitives (PageHead / StatRow / Card / Pill /
// BarChart); ALL live data wiring is preserved verbatim — the same react-query
// hooks feed the same values. Light-first (the design system is light-only).
// No mock/placeholder data: every stat + chart value is derived from the live
// /api/dashboard/alerts, /api/elections/active-summary, /api/associations
// queries this page already consumed.
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  Card,
  PageHead,
  Stat,
  StatRow,
  Pill,
  BarChart,
  Tiles,
  Cols2,
  type PillTone,
} from "@ycm/design-system";
import {
  Building2,
  AlertTriangle,
  Clock,
  ShieldAlert,
  BadgeDollarSign,
  Wrench,
  CalendarPlus,
  UserPlus,
  CircleDollarSign,
  Sparkles,
  Vote,
  Timer,
  ClipboardCheck,
  CalendarClock,
} from "lucide-react";
import { SetupWizard } from "@/components/setup-wizard";
import { SignupOnboardingChecklist } from "@/components/signup-onboarding-checklist";
import { HomeAlertsPanel } from "@/components/home-alerts-panel";
import { Skeleton } from "@/components/ui/skeleton";
import { useAssociationContext } from "@/context/association-context";
import { AssociationScopeBanner } from "@/components/association-scope-banner";
import { PressingItemsWidget } from "@/components/pressing-items/PressingItemsWidget";
import { AsyncStateBoundary } from "@/components/async-state-boundary";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { t } from "@/i18n/use-strings";
import type { AdminRole } from "@shared/schema";

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
  // Signal 1 (0.1 AC 4): overdue work orders — cross-association, surfaced on Home
  // regardless of active association context. Active/not-completed WOs whose scheduled
  // date has passed.
  overdueWorkOrders: {
    count: number;
    items: Array<{ id: string; title: string; scheduledFor: string | null; associationId: string }>;
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
  // Signal 2 (0.1 AC 4): maintenance schedule instances due within the next 7 days —
  // cross-association, surfaced on Home regardless of active association context.
  dueMaintenanceInstances: {
    count: number;
    items: Array<{ id: string; title: string; dueAt: string; associationId: string }>;
  };
  orphanWarnings?: Array<{ type: string; message: string; count: number }>;
}

/* ── Needs-attention row (design-system restyle of the alert rows) ─────────── */
function AlertRow({
  icon: Icon,
  label,
  count,
  sublabel,
  href,
  tone,
}: {
  icon: typeof AlertTriangle;
  label: string;
  count: number;
  sublabel: string;
  href: string;
  tone: PillTone;
}) {
  if (count === 0) return null;
  return (
    <div className="ds-tile" style={{ textAlign: "left" }}>
      <div className="ds-ic" aria-hidden="true">
        <Icon className="h-4 w-4" />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="ds-tt">{label}</div>
        <div className="ds-ss">{sublabel}</div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
        <Pill tone={tone}>{count}</Pill>
        <Link href={href} className="ds-more" aria-label={`${t("common.review")} ${label}`}>
          {t("common.review")}
        </Link>
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

/* ── Live KPI stat row (design-system) — every value from the alerts query ─── */
function DashboardStats({ alerts, loading }: { alerts: DashboardAlerts | undefined; loading: boolean }) {
  if (loading) {
    return (
      <StatRow>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="ds-stat" role="status" aria-label={t("common.loading")}>
            <Skeleton className="h-3 w-20" />
            <Skeleton className="mt-2 h-7 w-12" />
            <Skeleton className="mt-2 h-3 w-16" />
          </div>
        ))}
      </StatRow>
    );
  }

  const wo = alerts?.workOrders;
  const overdueWo = alerts?.overdueWorkOrders?.count ?? 0;
  const openWo = wo?.totalOpen ?? 0;
  const urgentWo = wo?.urgent ?? 0;
  const stalledWo = wo?.stalledOpen ?? 0;

  const complOverdue = alerts?.complianceTasks.overdue ?? 0;
  const complDueSoon = alerts?.complianceTasks.dueSoon ?? 0;
  const complTotal = complOverdue + complDueSoon;

  const insExpired = alerts?.vendorInsurance.expired ?? 0;
  const insDueSoon = alerts?.vendorInsurance.dueSoon ?? 0;
  const insTotal = insExpired + insDueSoon;

  const delinquent = alerts?.delinquentAccounts.count ?? 0;

  return (
    <StatRow>
      <Stat
        label="Open work orders"
        value={openWo}
        delta={
          urgentWo > 0
            ? `${urgentWo} urgent`
            : stalledWo > 0
              ? `${stalledWo} stalled`
              : overdueWo > 0
                ? `${overdueWo} overdue`
                : "On track"
        }
        deltaTone={urgentWo > 0 || overdueWo > 0 ? "bad" : stalledWo > 0 ? "warn" : "good"}
      />
      <Stat
        label="Compliance"
        value={complTotal}
        delta={complOverdue > 0 ? `${complOverdue} overdue` : complDueSoon > 0 ? `${complDueSoon} due soon` : "Clear"}
        deltaTone={complOverdue > 0 ? "bad" : complDueSoon > 0 ? "warn" : "good"}
      />
      <Stat
        label="Insurance"
        value={insTotal}
        delta={insExpired > 0 ? `${insExpired} expired` : insDueSoon > 0 ? `${insDueSoon} expiring` : "Current"}
        deltaTone={insExpired > 0 ? "bad" : insDueSoon > 0 ? "warn" : "good"}
      />
      <Stat
        label="Delinquent"
        value={delinquent}
        delta={delinquent > 0 ? `${delinquent} account${delinquent === 1 ? "" : "s"}` : "None"}
        deltaTone={delinquent > 0 ? "warn" : "good"}
      />
    </StatRow>
  );
}

/* ── Attention-by-category chart (design-system BarChart, live data) ───────── */
function AttentionChart({ alerts }: { alerts: DashboardAlerts | undefined }) {
  const data = [
    { label: "Work", value: (alerts?.workOrders.totalOpen ?? 0) + (alerts?.overdueWorkOrders?.count ?? 0) },
    { label: "Maint", value: alerts?.dueMaintenanceInstances?.count ?? 0 },
    { label: "Compl", value: (alerts?.complianceTasks.overdue ?? 0) + (alerts?.complianceTasks.dueSoon ?? 0) },
    { label: "Insur", value: (alerts?.vendorInsurance.expired ?? 0) + (alerts?.vendorInsurance.dueSoon ?? 0) },
    { label: "Delinq", value: alerts?.delinquentAccounts.count ?? 0 },
  ];
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <Card title="Attention by category">
      {total === 0 ? (
        <p className="text-sm text-muted-foreground">{t("home.alerts.allClear")}</p>
      ) : (
        <BarChart data={data} />
      )}
    </Card>
  );
}

/* ── Active elections (design-system Card + Pill) ──────────────────────────── */
function ActiveElectionsCard({
  elections,
  loading,
}: {
  elections: ActiveElectionSummary[] | undefined;
  loading: boolean;
}) {
  const openElections = (elections ?? []).filter((e) => e.status === "open");

  return (
    <Card title={t("home.activeElections.title")}>
      {loading ? (
        <div className="space-y-3" role="status" aria-label={t("common.loading")}>
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : openElections.length === 0 ? (
        <div className="text-center py-4" role="status">
          <Vote className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" aria-hidden="true" />
          <p className="text-sm text-muted-foreground">{t("home.activeElections.empty")}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {openElections.map((election) => (
            <Link
              key={election.id}
              href={`/app/governance/elections/${election.id}`}
              className="ds-tile"
              style={{ display: "block", textAlign: "left" }}
              aria-label={`${election.title} — ${
                election.quorumMet ? t("home.activeElections.quorumMet") : t("home.activeElections.noQuorum")
              }`}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 6 }}>
                <span className="ds-tt" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {election.title}
                </span>
                <Pill tone={election.quorumMet ? "ok" : "muted"}>
                  {election.quorumMet ? t("home.activeElections.quorumMet") : t("home.activeElections.noQuorum")}
                </Pill>
              </div>
              <div className="ds-bar" role="progressbar" aria-valuenow={election.participationPercent} aria-valuemin={0} aria-valuemax={100}>
                <i style={{ width: `${election.participationPercent}%` }} />
              </div>
              <div className="ds-ss" style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
                <span>
                  {election.castCount} of {election.eligibleVoterCount} voted ({election.participationPercent}%)
                </span>
                {election.closesAt && (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                    <Clock className="h-3 w-3" aria-hidden="true" />
                    {formatTimeRemaining(election.closesAt)}
                  </span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </Card>
  );
}

/* ── Quick actions (design-system Tiles) ───────────────────────────────────── */
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
  const disabledCommon = !activeAssociationId || isViewer;
  const disabledTitle = isViewer ? "Read-only access" : activeAssociationId ? undefined : "Select an association first";

  const actions: Array<{ label: string; icon: typeof Wrench; href: string; disabled: boolean }> = [
    { label: t("home.quickActions.newWorkOrder"), icon: Wrench, href: "/app/work-orders", disabled: disabledCommon },
    { label: t("home.quickActions.scheduleMeeting"), icon: CalendarPlus, href: "/app/governance/meetings", disabled: disabledCommon },
    { label: t("home.quickActions.inviteBoardMember"), icon: UserPlus, href: "/app/board", disabled: disabledCommon },
    // [0.1 AC 10] Billing quick-action points directly at /app/financial/billing.
    { label: t("home.quickActions.billing"), icon: CircleDollarSign, href: "/app/financial/billing", disabled: disabledCommon },
  ];

  return (
    <Card title={t("home.quickActions.title")}>
      <Tiles>
        {actions.map((action) =>
          action.disabled ? (
            <div key={action.label} className="ds-tile" title={disabledTitle} aria-label={action.label} style={{ opacity: 0.5 }}>
              <div className="ds-ic" aria-hidden="true">
                <action.icon className="h-4 w-4" />
              </div>
              <div className="ds-tt">{action.label}</div>
            </div>
          ) : (
            <Link key={action.label} href={action.href} className="ds-tile" aria-label={action.label}>
              <div className="ds-ic" aria-hidden="true">
                <action.icon className="h-4 w-4" />
              </div>
              <div className="ds-tt">{action.label}</div>
            </Link>
          ),
        )}
        <button type="button" className="ds-tile" onClick={onNewAssociation} aria-label={t("home.quickActions.newAssociation")} style={{ cursor: "pointer" }}>
          <div className="ds-ic" aria-hidden="true">
            <Building2 className="h-4 w-4" />
          </div>
          <div className="ds-tt">{t("home.quickActions.newAssociation")}</div>
        </button>
      </Tiles>
      {!activeAssociationId && <p className="mt-2 text-xs text-muted-foreground">{t("home.quickActions.selectAssociationHint")}</p>}
    </Card>
  );
}

/* ── Needs-attention panel (design-system Card, live alerts) ───────────────── */
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

  const electionsAwaitingCertification = (activeElections ?? []).filter((e) => e.status === "closed");

  const totalAlerts =
    (alerts?.workOrders.urgent ?? 0) +
    (alerts?.workOrders.stalledOpen ?? 0) +
    (alerts?.overdueWorkOrders?.count ?? 0) +
    (alerts?.dueMaintenanceInstances?.count ?? 0) +
    (alerts?.complianceTasks.overdue ?? 0) +
    (alerts?.complianceTasks.dueSoon ?? 0) +
    (alerts?.vendorInsurance.expired ?? 0) +
    (alerts?.vendorInsurance.dueSoon ?? 0) +
    (alerts?.delinquentAccounts.count ?? 0) +
    (alerts?.orphanWarnings ?? []).reduce((sum, w) => sum + w.count, 0) +
    electionsClosingSoon.length +
    electionsAwaitingCertification.length;

  const subtitle = activeAssociationId ? t("home.alerts.subtitleScoped") : t("home.alerts.subtitlePortfolio");

  return (
    <Card
      title={
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          {t("home.alerts.title")}
          {!loading && totalAlerts > 0 ? <Pill tone="bad">{totalAlerts}</Pill> : null}
        </span>
      }
      more={subtitle}
    >
      {loading ? (
        <div className="space-y-2" role="status" aria-label={t("common.loading")}>
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </div>
      ) : totalAlerts === 0 ? (
        <div className="ds-tile" role="status" style={{ display: "block", textAlign: "center" }}>
          <div className="ds-tt" style={{ color: "var(--ds-good, #15803d)" }}>{t("home.alerts.allClear")}</div>
          <div className="ds-ss" style={{ marginTop: 4 }}>{t("home.alerts.allClearBody")}</div>
        </div>
      ) : (
        <div className="space-y-2">
          {/* [0.1 AC 4 — Signal 1] Cross-association overdue work orders. */}
          <AlertRow
            icon={AlertTriangle}
            tone="bad"
            label={t("home.alert.overdueWorkOrders.label")}
            count={alerts?.overdueWorkOrders?.count ?? 0}
            sublabel={t("home.alert.overdueWorkOrders.sub")}
            href="/app/work-orders"
          />
          {/* [0.1 AC 4 — Signal 2] Cross-association maintenance due within 7 days. */}
          <AlertRow
            icon={CalendarClock}
            tone="warn"
            label={t("home.alert.dueMaintenance.label")}
            count={alerts?.dueMaintenanceInstances?.count ?? 0}
            sublabel={t("home.alert.dueMaintenance.sub")}
            href="/app/maintenance-schedules"
          />
          <AlertRow
            icon={AlertTriangle}
            tone="bad"
            label={t("home.alert.urgentWorkOrders.label")}
            count={alerts?.workOrders.urgent ?? 0}
            sublabel={t("home.alert.urgentWorkOrders.sub")}
            href="/app/work-orders"
          />
          <AlertRow
            icon={Clock}
            tone="warn"
            label={t("home.alert.stalledWorkOrders.label")}
            count={alerts?.workOrders.stalledOpen ?? 0}
            sublabel={t("home.alert.stalledWorkOrders.sub")}
            href="/app/work-orders"
          />
          <AlertRow
            icon={AlertTriangle}
            tone="bad"
            label={t("home.alert.complianceOverdue.label")}
            count={alerts?.complianceTasks.overdue ?? 0}
            sublabel={t("home.alert.complianceOverdue.sub")}
            href="/app/governance/compliance"
          />
          <AlertRow
            icon={Clock}
            tone="warn"
            label={t("home.alert.complianceDueSoon.label")}
            count={alerts?.complianceTasks.dueSoon ?? 0}
            sublabel={t("home.alert.complianceDueSoon.sub")}
            href="/app/governance/compliance"
          />
          <AlertRow
            icon={ShieldAlert}
            tone="bad"
            label={t("home.alert.insuranceExpired.label")}
            count={alerts?.vendorInsurance.expired ?? 0}
            sublabel={t("home.alert.insuranceExpired.sub")}
            href="/app/vendors"
          />
          <AlertRow
            icon={ShieldAlert}
            tone="warn"
            label={t("home.alert.insuranceDueSoon.label")}
            count={alerts?.vendorInsurance.dueSoon ?? 0}
            sublabel={t("home.alert.insuranceDueSoon.sub")}
            href="/app/vendors"
          />
          {activeAssociationId && (
            <AlertRow
              icon={BadgeDollarSign}
              tone="warn"
              label={t("home.alert.delinquent.label")}
              count={alerts?.delinquentAccounts.count ?? 0}
              sublabel={t("home.alert.delinquent.sub")}
              href="/app/financial/ledger"
            />
          )}
          {(alerts?.orphanWarnings ?? []).map((warning) => (
            <AlertRow
              key={warning.type}
              icon={AlertTriangle}
              tone="warn"
              label={t("home.alert.dataIntegrity.label")}
              count={warning.count}
              sublabel={warning.message}
              href="/app/persons"
            />
          ))}
          {electionsClosingSoon.map((election) => (
            <div key={`closing-${election.id}`} className="ds-tile" style={{ textAlign: "left" }}>
              <div className="ds-ic" aria-hidden="true">
                <Timer className="h-4 w-4" />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="ds-tt">Election closing soon: {election.title}</div>
                <div className="ds-ss">
                  {election.closesAt ? formatTimeRemaining(election.closesAt) : ""} — {election.participationPercent}% participation
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                <Pill tone="bad">1</Pill>
                <Link href={`/app/governance/elections/${election.id}`} className="ds-more" aria-label={`${t("common.review")} ${election.title}`}>
                  {t("common.review")}
                </Link>
              </div>
            </div>
          ))}
          {electionsAwaitingCertification.map((election) => (
            <div key={`certify-${election.id}`} className="ds-tile" style={{ textAlign: "left" }}>
              <div className="ds-ic" aria-hidden="true">
                <ClipboardCheck className="h-4 w-4" />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="ds-tt">Election awaiting certification: {election.title}</div>
                <div className="ds-ss">
                  Voting closed — {election.participationPercent}% participation, {election.quorumMet ? "quorum met" : "quorum not met"}
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                <Pill tone="bad">1</Pill>
                <Link href={`/app/governance/elections/${election.id}`} className="ds-more" aria-label={`Certify ${election.title}`}>
                  Certify
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

type AuthSession = { authenticated: boolean; admin?: { role: AdminRole } | null };

export default function DashboardPage() {
  useDocumentTitle(t("home.title"));
  const [wizardOpen, setWizardOpen] = useState(false);
  const { activeAssociationId, setActiveAssociationId } = useAssociationContext();
  const { data: authSession } = useQuery<AuthSession>({ queryKey: ["/api/auth/session"] });
  const adminRole: AdminRole | null = authSession?.admin?.role ?? null;

  // [0.1 AC 2] Portfolio-level aggregate stat cards moved to /app/portfolio.
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

  // [0.1 AC 2] Derive "no associations" from the already-queried associations list.
  const noAssociations = !associationsLoading && associations.length === 0;
  const activeAssociationName = associations?.find((a) => a.id === activeAssociationId)?.name ?? "";

  return (
    <div className="ds-scope p-3 sm:p-6 space-y-6">
      <SetupWizard open={wizardOpen} onOpenChange={setWizardOpen} onAssociationCreated={(id) => setActiveAssociationId(id)} />

      {/* [0.1 AC 1] Page title/breadcrumb/nav all read "Home" — "Dashboard" is
          intentionally absent from this surface per the 0.1 decision. */}
      <PageHead
        eyebrow={t("home.eyebrow")}
        title={activeAssociationName ? `${t("home.title")} — ${activeAssociationName}` : t("home.title")}
        lede={t("home.summary")}
        actions={
          <Link href="/app/portfolio" className="ds-btn ds-ghost" data-testid="link-home-to-portfolio-health" aria-label={t("home.portfolioHealth.cta")}>
            {t("home.portfolioHealth.cta")}
          </Link>
        }
      />

      {noAssociations && (
        <Card>
          <div style={{ display: "flex", flexDirection: "column", gap: 16, alignItems: "center", textAlign: "center" }}>
            <div className="ds-ic" aria-hidden="true">
              <Sparkles className="h-6 w-6" />
            </div>
            <div>
              <p className="ds-tt">{t("home.welcome.title")}</p>
              <p className="ds-ss" style={{ marginTop: 2 }}>{t("home.welcome.body")}</p>
            </div>
            <button type="button" className="ds-btn ds-accent" onClick={() => setWizardOpen(true)}>
              {t("home.welcome.cta")}
            </button>
          </div>
        </Card>
      )}

      {adminRole === "viewer" && (
        <div className="rounded-lg border bg-muted/40 px-4 py-3 text-sm text-muted-foreground" role="status">
          {t("home.viewerBanner")}
        </div>
      )}

      <AssociationScopeBanner
        activeAssociationId={activeAssociationId}
        activeAssociationName={activeAssociationName}
        explanation={
          activeAssociationId
            ? "The selected association controls in-context pages, filtered records, and create actions across the admin workspace."
            : "Select an association to move from portfolio oversight into a scoped operating workspace."
        }
      />

      {/* Live KPI stat row — every value derived from /api/dashboard/alerts. */}
      <DashboardStats alerts={alerts} loading={alertsLoading} />

      {/* Pressing Items widget (founder-os#1256 Phase 1). Scoped to the active association. */}
      {activeAssociationId ? <PressingItemsWidget surface="admin" associationId={activeAssociationId} /> : null}

      {/* [4.4 Q2 AC 1-5] Post-signup onboarding banner — 4-item locked checklist. */}
      <SignupOnboardingChecklist />

      {/* [4.1 Wave 3] Cross-association alert engine — Home surface. */}
      <HomeAlertsPanel />

      <QuickActions activeAssociationId={activeAssociationId} onNewAssociation={() => setWizardOpen(true)} adminRole={adminRole} />

      {/* Needs-attention + Upcoming, side by side, both from live queries. */}
      <Cols2>
        <AlertsPanel alerts={alerts} loading={alertsLoading} activeAssociationId={activeAssociationId} activeElections={activeElections} />
        <ActiveElectionsCard elections={activeElections} loading={electionsLoading} />
      </Cols2>

      {/* Design-system chart helper — live attention-by-category breakdown. */}
      <AttentionChart alerts={alerts} />

      <AsyncStateBoundary
        isLoading={associationsLoading}
        isEmpty={!associationsLoading && associations.length === 0}
        emptyTitle={t("home.associations.empty.title")}
        emptyMessage={t("home.associations.empty.body")}
      >
        <Card
          title={t("home.associations.title")}
          more={
            <Link href="/app/associations" className="ds-more" aria-label={t("home.associations.manage")}>
              {t("home.associations.manage")}
            </Link>
          }
        >
          <div className="space-y-2">
            {associations.slice(0, 5).map((association) => (
              <div key={association.id} className="ds-tile" style={{ textAlign: "left" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="ds-tt">{association.name}</div>
                  <div className="ds-ss">
                    {association.city}, {association.state}
                  </div>
                </div>
                <button
                  type="button"
                  className={association.id === activeAssociationId ? "ds-btn" : "ds-btn ds-ghost"}
                  onClick={() => setActiveAssociationId(association.id)}
                  data-testid={`button-set-dashboard-context-${association.id}`}
                  aria-label={`${
                    association.id === activeAssociationId ? t("home.associations.inContext") : t("home.associations.useContext")
                  } ${association.name}`}
                >
                  {association.id === activeAssociationId ? t("home.associations.inContext") : t("home.associations.useContext")}
                </button>
              </div>
            ))}
          </div>
        </Card>
      </AsyncStateBoundary>

      {activeAssociationId ? (
        <Card
          title={t("home.currentContext.title")}
          more={
            <Link href="/app/association-context" className="ds-more" aria-label={t("home.currentContext.cta")}>
              {t("home.currentContext.cta")}
            </Link>
          }
        >
          <p className="text-sm text-muted-foreground">{t("home.currentContext.body")}</p>
        </Card>
      ) : null}
    </div>
  );
}
