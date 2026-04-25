// zone: Platform (settings)
// persona: Manager, Board Officer, PM Assistant, Platform Admin
/**
 * /app/settings/billing — Billing management entry point (4.4 Q6, Wave 13).
 *
 * Spec (decisions/4.4-signup-and-checkout-flow.md Q6, 2026-04-24):
 *   - Manager + Board Officer + PM Assistant + Platform Admin personas.
 *     Viewer + Owner personas are denied (redirected to /app).
 *   - Surface shows: current plan, status, trial end date (if trialing),
 *     current period end, and a "Manage Billing" CTA that opens the
 *     Stripe Customer Portal in a new tab.
 *   - No in-app plan-comparison surface — upgrade/downgrade happens via
 *     Stripe Customer Portal. YCM owns only the entry point.
 *
 * Data source: GET /api/admin/billing/subscription.
 * Portal open: POST /api/admin/billing/portal-session → window.open in new tab.
 *
 * Route registered in App.tsx WorkspaceRouter.
 */

import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useEffect } from "react";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, CreditCard, AlertCircle } from "lucide-react";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { useAdminRole } from "@/hooks/useAdminRole";
import { EmptyState } from "@/components/empty-state";
import { t } from "@/i18n/use-strings";

// 4.4 Q6 Wave 13 — role gate. Mirrors the requireAdminRole on
// POST /api/admin/billing/portal-session at server/routes.ts:13390.
const ALLOWED_ROLES = ["platform-admin", "manager", "board-officer", "pm-assistant"] as const;

type PlatformSubscription = {
  status: "trialing" | "active" | "past_due" | "canceled" | "unpaid" | "incomplete";
  plan: "self-managed" | "property-manager" | "enterprise";
  trialEndsAt?: string | null;
  currentPeriodEnd?: string | null;
  cancelAtPeriodEnd?: number;
};

type BillingResponse = PlatformSubscription | { status: "none" };

// PRICING STALE — "enterprise" display label will be updated when PM tier
// naming is finalized. See docs/strategy/pricing-and-positioning.md.
function planLabel(plan: string): string {
  if (plan === "self-managed") return t("settings.billing.plan.selfManaged");
  if (plan === "property-manager") return t("settings.billing.plan.propertyManager");
  if (plan === "enterprise") return t("settings.billing.plan.enterprise");
  return plan;
}

function statusLabel(status: string): string {
  if (status === "trialing") return t("settings.billing.status.trialing");
  if (status === "active") return t("settings.billing.status.active");
  if (status === "past_due") return t("settings.billing.status.pastDue");
  if (status === "canceled") return t("settings.billing.status.canceled");
  if (status === "unpaid") return t("settings.billing.status.unpaid");
  if (status === "incomplete") return t("settings.billing.status.incomplete");
  return status;
}

function statusBadgeVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  if (status === "active") return "default";
  if (status === "trialing") return "secondary";
  if (status === "canceled" || status === "unpaid") return "destructive";
  return "outline";
}

export default function SettingsBillingPage() {
  useDocumentTitle(`${t("settings.billing.title")} · Settings`);
  const { role, authResolved } = useAdminRole();
  const [, navigate] = useLocation();

  const allowed = authResolved && role !== null && (ALLOWED_ROLES as readonly string[]).includes(role);

  useEffect(() => {
    if (authResolved && !allowed) {
      navigate("/app");
    }
  }, [authResolved, allowed, navigate]);

  const { data: billingData, isLoading } = useQuery<BillingResponse>({
    queryKey: ["/api/admin/billing/subscription"],
    enabled: allowed,
    staleTime: 5 * 60 * 1000,
  });

  async function openPortal() {
    try {
      const res = await fetch("/api/admin/billing/portal-session", {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) return;
      const { url } = (await res.json()) as { url?: string };
      if (url) {
        // 4.4 Q6 Wave 13 — open in new tab with noopener.
        window.open(url, "_blank", "noopener,noreferrer");
      }
    } catch {
      /* ignore — button re-enables on next click */
    }
  }

  if (!authResolved || !allowed) {
    return null;
  }

  const subscription: PlatformSubscription | null =
    billingData && "plan" in billingData ? billingData : null;

  const hasBilling = Boolean(subscription);

  return (
    <div className="min-h-full bg-surface-container-low">
      <div className="max-w-3xl mx-auto px-6 py-10 space-y-6">
        <div>
          <h1 className="font-headline text-3xl font-bold text-on-surface">{t("settings.billing.title")}</h1>
          <p className="text-sm text-on-surface-variant mt-1">
            {t("settings.billing.subtitle")}
          </p>
        </div>

        {isLoading ? (
          <Card>
            <CardContent className="py-12 text-center text-sm text-muted-foreground" role="status">
              {t("settings.billing.loading")}
            </CardContent>
          </Card>
        ) : !hasBilling ? (
          <EmptyState
            icon={AlertCircle}
            title={t("settings.billing.empty.title")}
            description={t("settings.billing.empty.body")}
            testId="billing-empty-state"
          />
        ) : (
          <>
            <Card data-testid="billing-plan-card">
              <CardHeader>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <CreditCard className="h-5 w-5" aria-hidden="true" />
                      {planLabel(subscription!.plan)}
                    </CardTitle>
                    <CardDescription>{t("settings.billing.plan.currentLabel")}</CardDescription>
                  </div>
                  <Badge
                    variant={statusBadgeVariant(subscription!.status)}
                    data-testid="billing-status-badge"
                  >
                    {statusLabel(subscription!.status)}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {subscription!.status === "trialing" && subscription!.trialEndsAt && (
                  <div className="text-sm" data-testid="billing-trial-info">
                    <span className="text-muted-foreground">{t("settings.billing.trial.endsLabel")}</span>{" "}
                    <strong>{format(new Date(subscription!.trialEndsAt), "MMM d, yyyy")}</strong>
                    <p className="text-xs text-muted-foreground mt-1">
                      {t("settings.billing.trial.note")}
                    </p>
                  </div>
                )}
                {subscription!.currentPeriodEnd && subscription!.status !== "trialing" && (
                  <div className="text-sm" data-testid="billing-period-info">
                    <span className="text-muted-foreground">
                      {subscription!.cancelAtPeriodEnd
                        ? t("settings.billing.period.cancels")
                        : t("settings.billing.period.next")}
                    </span>{" "}
                    <strong>{format(new Date(subscription!.currentPeriodEnd), "MMM d, yyyy")}</strong>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{t("settings.billing.manage.title")}</CardTitle>
                <CardDescription>
                  {t("settings.billing.manage.body")}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  onClick={openPortal}
                  data-testid="billing-manage-cta"
                  className="gap-2"
                  aria-label={t("settings.billing.manage.cta")}
                >
                  {t("settings.billing.manage.cta")}
                  <ExternalLink className="h-4 w-4" aria-hidden="true" />
                </Button>
                <p className="text-xs text-muted-foreground mt-3">
                  {t("settings.billing.manage.note")}
                </p>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
