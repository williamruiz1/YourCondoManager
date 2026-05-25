/**
 * /app/admin/platform/subscriptions — Founder portfolio subscription view
 * (founder-os#1147).
 *
 * Platform-admin only. Lists every association in the portfolio with its
 * current platform_subscription state (or "no subscription"). Used by
 * William + ops to see who's paying, who's trialing, who's past_due, and
 * who hasn't been billed yet.
 *
 * Data source: GET /api/platform/subscriptions
 *
 * Sibling surfaces:
 *   /app/platform/controls — aggregate MRR + plan counts
 *     (PlatformStripeConfigCard, see client/src/pages/platform-controls.tsx)
 *   /app/settings/billing — association-scoped manage flow (manager surface)
 *     (see client/src/pages/settings-billing.tsx)
 */

import { useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAdminRole } from "@/hooks/useAdminRole";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { EmptyState } from "@/components/empty-state";
import { CreditCard } from "lucide-react";

type PortfolioSubscriptionRow = {
  associationId: string;
  associationName: string;
  city: string | null;
  state: string | null;
  subscriptionId: string | null;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  plan: "self-managed" | "property-manager" | "enterprise" | null;
  status: string;
  currentPeriodEnd: string | null;
  trialEndsAt: string | null;
  cancelAtPeriodEnd: number;
  unitTier: number | null;
  unitCount: number | null;
  adminEmail: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

type PortfolioResponse = {
  subscriptions: PortfolioSubscriptionRow[];
};

function statusBadgeVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  if (status === "active") return "default";
  if (status === "trialing") return "secondary";
  if (status === "canceled" || status === "unpaid" || status === "past_due") return "destructive";
  return "outline";
}

function planLabel(plan: string | null): string {
  if (plan === "self-managed") return "Self-Managed";
  if (plan === "property-manager") return "Property Manager";
  if (plan === "enterprise") return "Enterprise";
  return "—";
}

function formatDate(value: string | null): string {
  if (!value) return "—";
  try {
    return format(new Date(value), "MMM d, yyyy");
  } catch {
    return value;
  }
}

export default function AdminPlatformSubscriptionsPage() {
  useDocumentTitle("Platform Subscriptions · Admin");
  const { role, authResolved } = useAdminRole();
  const [, navigate] = useLocation();

  const allowed = authResolved && role === "platform-admin";

  useEffect(() => {
    if (authResolved && !allowed) {
      navigate("/app");
    }
  }, [authResolved, allowed, navigate]);

  const { data, isLoading, error } = useQuery<PortfolioResponse>({
    queryKey: ["/api/platform/subscriptions"],
    enabled: allowed,
    staleTime: 60 * 1000,
  });

  if (!authResolved || !allowed) {
    return null;
  }

  const subs = data?.subscriptions ?? [];
  const withSub = subs.filter((s) => s.subscriptionId !== null);
  const withoutSub = subs.filter((s) => s.subscriptionId === null);
  const active = subs.filter((s) => s.status === "active").length;
  const trialing = subs.filter((s) => s.status === "trialing").length;
  const pastDue = subs.filter((s) => s.status === "past_due").length;
  const canceled = subs.filter((s) => s.status === "canceled").length;

  return (
    <div className="container mx-auto px-4 py-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Platform Subscriptions</h1>
        <p className="text-sm text-muted-foreground mt-1">
          All associations and their platform-fee subscription status. founder-os#1147.
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card>
          <CardContent className="p-4">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Total</div>
            <div className="text-2xl font-bold mt-1" data-testid="stat-total">{subs.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Active</div>
            <div className="text-2xl font-bold mt-1" data-testid="stat-active">{active}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Trialing</div>
            <div className="text-2xl font-bold mt-1" data-testid="stat-trialing">{trialing}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Past Due</div>
            <div className="text-2xl font-bold mt-1 text-destructive" data-testid="stat-past-due">{pastDue}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">No Subscription</div>
            <div className="text-2xl font-bold mt-1 text-muted-foreground" data-testid="stat-no-sub">{withoutSub.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Subscribed associations */}
      <Card>
        <CardHeader>
          <CardTitle>Subscribed Associations ({withSub.length})</CardTitle>
          <CardDescription>Associations with a platform_subscriptions row.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-sm text-muted-foreground py-6">Loading…</div>
          ) : error ? (
            <div className="text-sm text-destructive py-6">Error loading subscriptions.</div>
          ) : withSub.length === 0 ? (
            <EmptyState
              icon={CreditCard}
              title="No subscriptions yet"
              description="No associations have an active platform subscription. Use the backfill script or the public signup flow to create one."
            />
          ) : (
            <Table data-testid="table-subscriptions">
              <TableHeader>
                <TableRow>
                  <TableHead>Association</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Next Invoice</TableHead>
                  <TableHead>Trial Ends</TableHead>
                  <TableHead>Admin</TableHead>
                  <TableHead>Stripe</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {withSub.map((row) => (
                  <TableRow key={row.associationId} data-testid={`row-sub-${row.associationId}`}>
                    <TableCell>
                      <div className="font-medium">{row.associationName}</div>
                      {row.city && row.state ? (
                        <div className="text-xs text-muted-foreground">
                          {row.city}, {row.state}
                        </div>
                      ) : null}
                    </TableCell>
                    <TableCell>{planLabel(row.plan)}</TableCell>
                    <TableCell>
                      <Badge variant={statusBadgeVariant(row.status)} data-testid={`badge-status-${row.associationId}`}>
                        {row.status}
                      </Badge>
                      {row.cancelAtPeriodEnd ? (
                        <div className="text-xs text-muted-foreground mt-1">Canceling at period end</div>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-sm">{formatDate(row.currentPeriodEnd)}</TableCell>
                    <TableCell className="text-sm">{formatDate(row.trialEndsAt)}</TableCell>
                    <TableCell className="text-sm">{row.adminEmail ?? "—"}</TableCell>
                    <TableCell className="text-xs font-mono">
                      {row.stripeSubscriptionId ? (
                        <span title={row.stripeSubscriptionId}>{row.stripeSubscriptionId.slice(0, 14)}…</span>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Associations without a subscription */}
      {withoutSub.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Unbilled Associations ({withoutSub.length})</CardTitle>
            <CardDescription>
              Associations in the portfolio with no platform_subscriptions row. Candidates for the backfill script.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table data-testid="table-unbilled">
              <TableHeader>
                <TableRow>
                  <TableHead>Association</TableHead>
                  <TableHead>Location</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {withoutSub.map((row) => (
                  <TableRow key={row.associationId} data-testid={`row-unbilled-${row.associationId}`}>
                    <TableCell className="font-medium">{row.associationName}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {row.city && row.state ? `${row.city}, ${row.state}` : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
