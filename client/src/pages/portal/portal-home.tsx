// zone: Home
// persona: Owner
//
// 3.5 — PortalHome replaces the `overview` tab of the owner-portal.tsx
// mega-file. First-person label "Home" per 1.1 Q5; route = /portal per
// 1.2 Q4; title "Home — YCM" via useDocumentTitle per 1.4 Q7.

import { useEffect, useState } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { useQuery } from "@tanstack/react-query";
import type { MaintenanceRequest, PaymentTransaction } from "@shared/schema";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { PortalShell, usePortalContext, type PortalAssociationChoice } from "./portal-shell";
import { t } from "@/i18n/use-strings";

// 2026-07-14 (P0 payment-confirmation-ux, founder-os incident 2026-07-14) —
// Stripe Checkout redirects here with ?payment=success&txn=<id> (or
// ?payment=cancelled) per server/services/payment-service.ts's
// successUrl/cancelUrl. Before this fix, NOTHING read these params — an
// owner who just paid (William, CHC dues, $330 ACH) landed back on Home
// with zero acknowledgment. This formats the confirmation banner honestly:
// ACH/ any non-terminal transaction reads "processing", never "confirmed",
// until the transaction row actually reaches a terminal status.
function formatCents(cents: number): string {
  return (cents / 100).toLocaleString(undefined, { style: "currency", currency: "USD" });
}

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

  // Capture the redirect params ONCE via a lazy initializer so the banner
  // survives us stripping them from the URL (below) — otherwise the effect
  // that cleans the URL would also wipe the state we're reading from.
  const rawSearch = useSearch();
  const [, navigate] = useLocation();
  const [redirectParams] = useState(() => new URLSearchParams(rawSearch));
  const paymentParam = redirectParams.get("payment");
  const txnParam = redirectParams.get("txn");

  useEffect(() => {
    if (paymentParam) {
      // Clean the URL immediately so a refresh or back-navigation doesn't
      // re-trigger the banner / re-fetch a transaction already shown.
      navigate("/portal", { replace: true });
    }
    // Runs once on mount only — re-navigating within /portal must not
    // re-fire this (paymentParam is captured once via the lazy initializer
    // above; navigate is a stable wouter reference).
  }, []);

  const { data: redirectTxn, isLoading: redirectTxnLoading } = useQuery<PaymentTransaction>({
    queryKey: ["portal/payment-transactions", txnParam],
    enabled: paymentParam === "success" && !!txnParam,
    queryFn: async () => {
      const res = await portalFetch(`/api/portal/payment-transactions/${txnParam}`);
      if (!res.ok) throw new Error("Failed to load payment status");
      return res.json();
    },
  });

  const openRequests = requests.filter((r) => !["resolved", "closed", "rejected"].includes(r.status));
  const balance = financialDashboard?.balance ?? 0;
  // 2026-07-01 (display-only) — "Paid in full" state for the home balance card.
  const paidInFull = balance <= 0;
  const lastPaymentDate = financialDashboard?.lastPaymentDate ?? null;
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

      {paymentParam === "cancelled" ? (
        <Alert data-testid="portal-home-payment-cancelled">
          <AlertTitle>Payment not completed</AlertTitle>
          <AlertDescription>
            You left checkout before it finished — no charge was made. You can try again anytime from Finances.
          </AlertDescription>
        </Alert>
      ) : null}

      {paymentParam === "success" && txnParam ? (
        <Alert
          data-testid="portal-home-payment-confirmation"
          variant={redirectTxn?.status === "failed" ? "destructive" : "default"}
          className={redirectTxn?.status === "succeeded" ? "border-green-600/40 bg-green-50" : undefined}
        >
          <AlertTitle>
            {redirectTxnLoading
              ? "Checking your payment…"
              : redirectTxn?.status === "succeeded"
                ? "Payment confirmed"
                : redirectTxn?.status === "failed"
                  ? "Payment did not go through"
                  : "Payment submitted"}
          </AlertTitle>
          <AlertDescription>
            {redirectTxnLoading || !redirectTxn ? (
              "One moment…"
            ) : redirectTxn.status === "succeeded" ? (
              `Your ${formatCents(redirectTxn.amountCents)} payment has cleared. You'll get a receipt by email.`
            ) : redirectTxn.status === "failed" ? (
              `Your ${formatCents(redirectTxn.amountCents)} payment didn't go through${redirectTxn.failureReason ? ` (${redirectTxn.failureReason})` : ""}. No charge was made — you can try again from Finances.`
            ) : (
              `Your ${formatCents(redirectTxn.amountCents)} payment was submitted and is processing. Bank transfers (ACH) typically take 3-5 business days to clear; card payments usually clear within a minute. You'll get a receipt by email and your balance will update once it's confirmed.`
            )}
          </AlertDescription>
        </Alert>
      ) : null}

      {/* Pressing items (unmatched bank transactions, other owners'
       * delinquency status, vendor insurance, compliance deadlines) are
       * board/treasurer business and are NEVER shown here — the owner
       * portal is the wrong surface for this content regardless of the
       * viewer's board seat (William, 2026-07-14). That content stays on
       * the admin dashboard's PressingItemsWidget (surface="admin"),
       * including its Board-mode skin for volunteer board officers. */}

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
            {/* 2026-07-01 (display-only) — when the owner owes nothing, show a
                positive "Paid in full" state (with the date when we have it)
                instead of a bare "$0.00". A credit balance still reads as
                paid-in-full and surfaces the credit amount as context. */}
            {paidInFull ? (
              <>
                <p
                  className="mt-1 font-headline text-2xl text-on-surface"
                  data-testid="portal-home-balance"
                >
                  Paid in full
                </p>
                <p className="mt-0.5 text-xs text-on-surface-variant" data-testid="portal-home-balance-paid-context">
                  {lastPaymentDate
                    ? `Last payment ${new Date(lastPaymentDate).toLocaleDateString()}`
                    : balance < 0
                      ? `$${Math.abs(balance).toFixed(2)} credit on account`
                      : "No balance due"}
                </p>
              </>
            ) : (
              <p
                // Wave 25 — `text-secondary` resolves to a near-white tone in
                // light mode and fails WCAG AA color contrast (axe). The
                // destructive tone stays for non-zero balance.
                className="mt-1 font-headline text-3xl text-destructive"
                data-testid="portal-home-balance"
              >
                ${Math.abs(balance).toFixed(2)}
              </p>
            )}
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
