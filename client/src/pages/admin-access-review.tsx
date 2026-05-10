// zone: Platform
// persona: Platform Admin
//
// Admin access review surface — Issue #347 / WS7 (security-maturity-roadmap).
// Quarterly access review workflow: list all admin users with last-login
// + inactivity flags + per-user "Mark reviewed" / "Revoke access" actions
// + global "Mark review complete" button.
//
// All actions write to `audit_logs` for the Information Security Policy
// quarterly-review attestation evidence.

import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Shield, AlertCircle, CheckCircle2 } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { WorkspacePageHeader } from "@/components/workspace-page-header";
import { platformSubPages } from "@/lib/sub-page-nav";
import { MobileSectionShell } from "@/components/mobile-section-shell";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { useIsMobile } from "@/hooks/use-mobile";

interface AdminAccessReviewRow {
  id: string;
  email: string;
  role: string;
  isActive: number;
  createdAt: string;
  lastLoginAt: string | null;
  associationsCount: number;
  isInactive: boolean;          // 90+ days no login
  daysSinceLastLogin: number | null;
  accountAgeDays: number;
}

interface AccessReviewListResponse {
  users: AdminAccessReviewRow[];
  inactiveCount: number;
  totalCount: number;
  inactivityThresholdDays: number;
}

const roleLabels: Record<string, string> = {
  "platform-admin": "Platform Admin",
  "board-officer": "Board Officer",
  "assisted-board": "Assisted Board",
  "pm-assistant": "PM Assistant",
  manager: "Manager",
  viewer: "Viewer",
};

function formatDate(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatRelativeDays(days: number | null): string {
  if (days === null) return "Never logged in";
  if (days === 0) return "Today";
  if (days === 1) return "1 day ago";
  if (days < 30) return `${days} days ago`;
  if (days < 365) return `${Math.floor(days / 30)} mo ago`;
  return `${Math.floor(days / 365)} yr ago`;
}

export default function AdminAccessReviewPage() {
  useDocumentTitle("Access Review");
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [pendingId, setPendingId] = useState<string | null>(null);

  const { data, isLoading } = useQuery<AccessReviewListResponse>({
    queryKey: ["/api/admin/access-review/users"],
  });

  const markReviewed = useMutation({
    mutationFn: async (adminUserId: string) => {
      return apiRequest(
        "POST",
        `/api/admin/access-review/users/${adminUserId}/mark-reviewed`,
      );
    },
    onMutate: (id) => setPendingId(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/access-review/users"] });
      toast({ title: "Reviewed", description: "Access confirmed and logged to audit trail." });
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : "Mark-reviewed failed";
      toast({ title: "Action failed", description: message, variant: "destructive" });
    },
    onSettled: () => setPendingId(null),
  });

  const revoke = useMutation({
    mutationFn: async (adminUserId: string) => {
      return apiRequest(
        "POST",
        `/api/admin/access-review/users/${adminUserId}/revoke`,
      );
    },
    onMutate: (id) => setPendingId(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/access-review/users"] });
      toast({ title: "Access revoked", description: "Admin user deactivated and logged." });
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : "Revoke failed";
      toast({ title: "Action failed", description: message, variant: "destructive" });
    },
    onSettled: () => setPendingId(null),
  });

  const completeReview = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/admin/access-review/complete");
    },
    onSuccess: () => {
      toast({
        title: "Review complete",
        description: "Quarterly access review marked complete in the audit trail.",
      });
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : "Complete failed";
      toast({ title: "Action failed", description: message, variant: "destructive" });
    },
  });

  const inactiveCount = data?.inactiveCount ?? 0;
  const totalCount = data?.totalCount ?? 0;
  const thresholdDays = data?.inactivityThresholdDays ?? 90;

  const summary = (
    <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground" data-testid="access-review-summary">
      <span className="inline-flex items-center gap-1.5">
        <Shield className="h-4 w-4" /> {totalCount} admin user{totalCount === 1 ? "" : "s"}
      </span>
      {inactiveCount > 0 && (
        <span className="inline-flex items-center gap-1.5 text-amber-600">
          <AlertCircle className="h-4 w-4" />
          {inactiveCount} inactive ({thresholdDays}+ days)
        </span>
      )}
    </div>
  );

  const actions = (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        type="button"
        variant="default"
        onClick={() => completeReview.mutate()}
        disabled={completeReview.isPending || isLoading || totalCount === 0}
        data-testid="button-complete-review"
      >
        <CheckCircle2 className="mr-2 h-4 w-4" />
        {completeReview.isPending ? "Completing…" : "Mark Review Complete"}
      </Button>
    </div>
  );

  const tableContent = (() => {
    if (isLoading) {
      return (
        <div className="space-y-3 p-4" data-testid="access-review-loading">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      );
    }

    if (!data || data.users.length === 0) {
      return (
        <EmptyState
          icon={Shield}
          title="No admin users"
          description="No admin users found in the system."
        />
      );
    }

    return (
      <Table data-testid="access-review-table">
        <TableHeader>
          <TableRow>
            <TableHead>Email</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Last Login</TableHead>
            <TableHead className="hidden md:table-cell">Account Age</TableHead>
            <TableHead className="hidden md:table-cell">Associations</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.users.map((user) => (
            <TableRow
              key={user.id}
              data-testid={`row-admin-${user.id}`}
              className={user.isInactive ? "bg-amber-50/50" : undefined}
            >
              <TableCell className="font-medium">{user.email}</TableCell>
              <TableCell>
                <Badge variant="outline">{roleLabels[user.role] ?? user.role}</Badge>
              </TableCell>
              <TableCell title={user.lastLoginAt ?? "Never"}>
                {formatRelativeDays(user.daysSinceLastLogin)}
              </TableCell>
              <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                {Math.floor(user.accountAgeDays / 30)} mo
              </TableCell>
              <TableCell className="hidden md:table-cell text-sm">
                {user.associationsCount}
              </TableCell>
              <TableCell>
                {user.isActive === 0 ? (
                  <Badge variant="destructive">Deactivated</Badge>
                ) : user.isInactive ? (
                  <Badge variant="outline" className="border-amber-500 text-amber-700">
                    Inactive
                  </Badge>
                ) : (
                  <Badge variant="outline" className="border-emerald-500 text-emerald-700">
                    Active
                  </Badge>
                )}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => markReviewed.mutate(user.id)}
                    disabled={pendingId === user.id || user.isActive === 0}
                    data-testid={`button-mark-reviewed-${user.id}`}
                  >
                    Mark reviewed
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const ok = window.confirm(
                        `Revoke access for ${user.email}? This deactivates the admin user and is logged to audit.`,
                      );
                      if (ok) revoke.mutate(user.id);
                    }}
                    disabled={pendingId === user.id || user.isActive === 0}
                    data-testid={`button-revoke-${user.id}`}
                  >
                    Revoke access
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  })();

  const body = (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-0">{tableContent}</CardContent>
      </Card>
    </div>
  );

  if (isMobile) {
    return (
      <MobileSectionShell
        title="Access Review"
        eyebrow="Platform"
        summary="Quarterly admin user access review for Information Security Policy compliance"
      >
        <div className="space-y-4">
          {summary}
          {actions}
          {body}
        </div>
      </MobileSectionShell>
    );
  }

  return (
    <section className="space-y-6 p-4 sm:p-6" aria-labelledby="access-review-heading">
      <WorkspacePageHeader
        title="Access Review"
        headingId="access-review-heading"
        summary="Quarterly admin user access review for Information Security Policy compliance"
        eyebrow="Platform"
        breadcrumbs={[{ label: "Dashboard", href: "/app" }, { label: "Access Review" }]}
        subPages={platformSubPages}
        actions={actions}
      />
      <div className="mb-4">{summary}</div>
      {body}
    </section>
  );
}
