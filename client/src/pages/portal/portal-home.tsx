// zone: Home
// persona: Owner
//
// 3.5 — PortalHome replaces the `overview` tab of the owner-portal.tsx
// mega-file. First-person label "Home" per 1.1 Q5; route = /portal per
// 1.2 Q4; title "Home — YCM" via useDocumentTitle per 1.4 Q7.

import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import type { MaintenanceRequest } from "@shared/schema";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PortalShell, usePortalContext, type PortalAssociationChoice } from "./portal-shell";
import { t } from "@/i18n/use-strings";

type PortalNoticeHistory = {
  id: string;
  subject: string;
  bodyText: string;
  bodySnippet?: string | null;
  createdAt: string;
};

type MyUnitSummary = {
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

type ActiveElection = {
  election: { id: string; title: string; closesAt: string | null };
  token: string;
};

function PortalHomeContent() {
  const { session, portalFetch, associationName } = usePortalContext();

  const { data: myUnits = [] } = useQuery<MyUnitSummary[]>({
    queryKey: ["portal/my-units", session.id],
    queryFn: async () => {
      const res = await portalFetch("/api/portal/my-units");
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: financialDashboard } = useQuery<FinancialDashboard>({
    queryKey: ["portal/financial-dashboard", session.id],
    queryFn: async () => {
      const res = await portalFetch("/api/portal/financial-dashboard");
      if (!res.ok) throw new Error("Failed to load financial dashboard");
      return res.json();
    },
  });

  const { data: requests = [] } = useQuery<MaintenanceRequest[]>({
    queryKey: ["portal/maintenance-requests", session.id],
    queryFn: async () => {
      const res = await portalFetch("/api/portal/maintenance-requests");
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: notices = [] } = useQuery<PortalNoticeHistory[]>({
    queryKey: ["portal/notices", session.id],
    queryFn: async () => {
      const res = await portalFetch("/api/portal/notices");
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: activeElections = [] } = useQuery<ActiveElection[]>({
    queryKey: ["portal/elections/active", session.id],
    queryFn: async () => {
      const res = await portalFetch("/api/portal/elections/active");
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: amenitiesSettings } = useQuery<{ amenitiesEnabled: boolean }>({
    queryKey: ["portal/amenities-settings", session.id],
    queryFn: async () => {
      const res = await portalFetch("/api/portal/amenities/settings");
      if (!res.ok) return { amenitiesEnabled: false };
      return res.json();
    },
  });

  const openRequests = requests.filter((r) => !["resolved", "closed", "rejected"].includes(r.status));
  const balance = financialDashboard?.balance ?? 0;
  const greeting = session.firstName
    ? `Welcome, ${session.firstName}`
    : t("portal.home.greetingFallback");

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8" data-testid="portal-home">
      <section>
        {associationName ? (
          <p className="text-[10px] font-semibold uppercase tracking-widest text-primary">{associationName}</p>
        ) : null}
        <h1 className="mt-1 font-headline text-3xl md:text-4xl" data-testid="portal-home-heading">
          {greeting}
        </h1>
      </section>

      {activeElections.length > 0 ? (
        <section className="space-y-3" data-testid="portal-home-active-elections" aria-label={t("home.activeElections.title")}>
          {activeElections.map(({ election, token }) => (
            <div
              key={election.id}
              className="flex items-center gap-4 rounded-2xl border-2 border-primary/30 bg-primary/5 p-4"
            >
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-primary/10">
                <span className="material-symbols-outlined text-primary" aria-hidden="true">how_to_vote</span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-on-surface">{election.title}</p>
                <p className="text-xs text-on-surface-variant">
                  {election.closesAt
                    ? `Voting closes ${new Date(election.closesAt).toLocaleDateString()}`
                    : t("portal.home.elections.openForVoting")}
                </p>
              </div>
              <a
                href={`/vote/${token}`}
                className="shrink-0 rounded-lg bg-primary px-4 py-2 text-sm font-bold uppercase tracking-wider text-on-primary hover:bg-primary/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                aria-label={`${t("portal.home.elections.voteNow")} — ${election.title}`}
              >
                {t("portal.home.elections.voteNow")}
              </a>
            </div>
          ))}
        </section>
      ) : null}

      <section className="grid gap-4 md:grid-cols-3" data-testid="portal-home-summary-cards">
        <Card>
          <CardContent className="py-5">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-on-surface-variant">
              {t("portal.home.cards.yourUnits")}
            </p>
            <p className="mt-1 font-headline text-3xl" data-testid="portal-home-units-count">
              {myUnits.length}
            </p>
            {myUnits.length === 1 ? (
              <p className="mt-1 text-xs text-on-surface-variant">
                {[myUnits[0].building && `Bldg ${myUnits[0].building}`, myUnits[0].unitNumber && `Unit ${myUnits[0].unitNumber}`]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            ) : null}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-5">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-on-surface-variant">
              {t("portal.home.cards.balance")}
            </p>
            <p
              // Wave 25 — `text-secondary` resolves to a near-white tone in
              // light mode and fails WCAG AA color contrast (axe). Use the
              // standard on-surface foreground when there is no balance
              // due; the destructive tone stays for non-zero balance.
              className={`mt-1 font-headline text-3xl ${balance > 0 ? "text-destructive" : "text-on-surface"}`}
              data-testid="portal-home-balance"
            >
              ${Math.abs(balance).toFixed(2)}
            </p>
            <Link
              href="/portal/finances"
              className="mt-2 inline-flex rounded text-xs font-semibold text-primary hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              data-testid="portal-home-balance-link"
            >
              {t("portal.home.cards.viewFinances")}
            </Link>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-5">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-on-surface-variant">
              {t("portal.home.cards.openRequests")}
            </p>
            <p className="mt-1 font-headline text-3xl" data-testid="portal-home-open-requests">
              {openRequests.length}
            </p>
            <Link
              href="/portal/requests"
              className="mt-2 inline-flex rounded text-xs font-semibold text-primary hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              data-testid="portal-home-requests-link"
            >
              {t("portal.home.cards.submitOrTrack")}
            </Link>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 md:grid-cols-2" data-testid="portal-home-latest">
        <Card>
          <CardContent className="space-y-3 py-5">
            <div className="flex items-center justify-between">
              <h2 className="font-headline text-lg">{t("portal.home.notices.title")}</h2>
              <Link
                href="/portal/notices"
                className="rounded text-xs font-semibold text-primary hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                data-testid="portal-home-notices-link"
              >
                {t("common.viewAll")}
              </Link>
            </div>
            {notices.length === 0 ? (
              <p className="text-sm text-on-surface-variant" role="status">{t("portal.home.notices.empty")}</p>
            ) : (
              <ul className="space-y-2">
                {notices.slice(0, 3).map((notice) => (
                  <li
                    key={notice.id}
                    className="rounded-lg border border-outline-variant/10 p-3"
                    data-testid={`portal-home-notice-${notice.id}`}
                  >
                    <p className="text-sm font-medium">{notice.subject}</p>
                    <p className="mt-1 text-xs text-on-surface-variant line-clamp-2">
                      {notice.bodySnippet || notice.bodyText}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-3 py-5">
            <div className="flex items-center justify-between">
              <h2 className="font-headline text-lg">{t("portal.home.activity.title")}</h2>
              <Link
                href="/portal/requests"
                className="rounded text-xs font-semibold text-primary hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                data-testid="portal-home-activity-link"
              >
                {t("common.seeAll")}
              </Link>
            </div>
            {requests.length === 0 ? (
              <p className="text-sm text-on-surface-variant" role="status">{t("portal.home.activity.empty")}</p>
            ) : (
              <ul className="space-y-2">
                {requests.slice(0, 3).map((req) => (
                  <li key={req.id} className="flex items-center justify-between gap-2 rounded-lg border border-outline-variant/10 p-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{req.title}</p>
                      <p className="text-xs text-on-surface-variant">{new Date(req.createdAt).toLocaleDateString()}</p>
                    </div>
                    <Badge variant={["resolved", "closed"].includes(req.status) ? "secondary" : "default"} className="capitalize">
                      {req.status.replace(/-/g, " ")}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 md:grid-cols-3" data-testid="portal-home-shortcuts" aria-label="Portal shortcuts">
        <Link
          href="/portal/community"
          className="rounded-2xl border border-outline-variant/10 bg-surface p-5 transition-colors hover:border-primary/30 hover:bg-primary/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          data-testid="portal-home-shortcut-community"
        >
          <p className="text-[10px] font-semibold uppercase tracking-widest text-primary">{t("portal.home.shortcuts.communityEyebrow")}</p>
          <p className="mt-2 font-headline text-lg">{t("portal.home.shortcuts.communityTitle")}</p>
          <p className="mt-1 text-xs text-on-surface-variant">
            {t("portal.home.shortcuts.communityBody")}
          </p>
        </Link>
        {amenitiesSettings?.amenitiesEnabled ? (
          <Link
            href="/portal/amenities"
            className="rounded-2xl border border-outline-variant/10 bg-surface p-5 transition-colors hover:border-primary/30 hover:bg-primary/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            data-testid="portal-home-shortcut-amenities"
          >
            <p className="text-[10px] font-semibold uppercase tracking-widest text-primary">{t("portal.home.shortcuts.amenitiesEyebrow")}</p>
            <p className="mt-2 font-headline text-lg">{t("portal.home.shortcuts.amenitiesTitle")}</p>
            <p className="mt-1 text-xs text-on-surface-variant">
              {t("portal.home.shortcuts.amenitiesBody")}
            </p>
          </Link>
        ) : (
          <Link
            href="/portal/documents"
            className="rounded-2xl border border-outline-variant/10 bg-surface p-5 transition-colors hover:border-primary/30 hover:bg-primary/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            data-testid="portal-home-shortcut-documents"
          >
            <p className="text-[10px] font-semibold uppercase tracking-widest text-primary">{t("portal.home.shortcuts.documentsEyebrow")}</p>
            <p className="mt-2 font-headline text-lg">{t("portal.home.shortcuts.documentsTitle")}</p>
            <p className="mt-1 text-xs text-on-surface-variant">{t("portal.home.shortcuts.documentsBody")}</p>
          </Link>
        )}
        <Link
          href="/portal/finances/payment-methods"
          className="rounded-2xl border border-outline-variant/10 bg-surface p-5 transition-colors hover:border-primary/30 hover:bg-primary/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          data-testid="portal-home-shortcut-payment-methods"
        >
          <p className="text-[10px] font-semibold uppercase tracking-widest text-primary">{t("portal.home.shortcuts.paymentsEyebrow")}</p>
          <p className="mt-2 font-headline text-lg">{t("portal.home.shortcuts.paymentsTitle")}</p>
          <p className="mt-1 text-xs text-on-surface-variant">{t("portal.home.shortcuts.paymentsBody")}</p>
        </Link>
      </section>
    </div>
  );
}

export default function PortalHomePage() {
  useDocumentTitle(t("home.title"));
  return (
    <PortalShell>
      <PortalHomeContent />
    </PortalShell>
  );
}

export { PortalHomeContent };
export type { PortalAssociationChoice };
