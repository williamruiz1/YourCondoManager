// zone: Platform
// persona: Platform Admin / Board Admin
//
// #342 (WS3) — Admin consent audit view. Lists consent records across
// users for compliance review. Platform admins see raw IP + UA; other
// admin roles see masked values (first IP octet + UA vendor family only).
//
// Filters (composed via AND): userId, userEmail, policyVersion, limit.
//
// Route: /app/admin/consent-audit (registered in App.tsx).

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { WorkspacePageHeader } from "@/components/workspace-page-header";
import { ShieldCheck, EyeOff } from "lucide-react";

type ConsentAuditRow = {
  id: string;
  userId: string;
  userEmail: string;
  policyVersion: string;
  consentedAt: string;
  ipAddress: string | null;
  userAgent: string | null;
};

type ConsentAuditResponse = {
  currentPolicyVersion: string;
  masked: boolean;
  records: ConsentAuditRow[];
};

export default function AdminConsentAuditPage() {
  useDocumentTitle("Consent audit — YCM");

  const [userEmailFilter, setUserEmailFilter] = useState("");
  const [policyVersionFilter, setPolicyVersionFilter] = useState("");
  // Applied filters (only updates on Apply / clear so the query doesn't refire on every keystroke).
  const [appliedFilters, setAppliedFilters] = useState<{ userEmail?: string; policyVersion?: string }>({});

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    if (appliedFilters.userEmail) params.set("userEmail", appliedFilters.userEmail);
    if (appliedFilters.policyVersion) params.set("policyVersion", appliedFilters.policyVersion);
    return params.toString();
  }, [appliedFilters]);

  const { data, isLoading, isError, refetch } = useQuery<ConsentAuditResponse>({
    queryKey: ["admin/consent/audit", queryString],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/admin/consent/audit${queryString ? `?${queryString}` : ""}`);
      return (await res.json()) as ConsentAuditResponse;
    },
  });

  const records = data?.records ?? [];
  const masked = data?.masked ?? false;
  const currentVersion = data?.currentPolicyVersion;

  function applyFilters() {
    setAppliedFilters({
      userEmail: userEmailFilter.trim() || undefined,
      policyVersion: policyVersionFilter.trim() || undefined,
    });
  }

  function clearFilters() {
    setUserEmailFilter("");
    setPolicyVersionFilter("");
    setAppliedFilters({});
  }

  return (
    <div className="space-y-6" data-testid="admin-consent-audit">
      <WorkspacePageHeader
        title="Consent audit"
        summary="Audit trail of privacy and terms-of-service agreements across users. Filter by user, email, or policy version."
      />

      <Card>
        <CardContent className="py-5">
          <div className="flex items-start gap-4">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-primary/10">
              <ShieldCheck className="h-5 w-5 text-primary" aria-hidden="true" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-on-surface-variant">
                Current policy version
              </p>
              <p className="mt-1 font-headline text-xl" data-testid="admin-current-policy-version">
                {currentVersion ?? "—"}
              </p>
              {masked ? (
                <p className="mt-2 flex items-center gap-1 text-xs text-on-surface-variant" data-testid="admin-consent-audit-masked-banner">
                  <EyeOff className="h-3 w-3" aria-hidden="true" />
                  IP &amp; user-agent values are masked. Platform admins can request raw access.
                </p>
              ) : null}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="py-5">
          <h2 className="font-headline text-lg">Filters</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label htmlFor="filter-email" className="text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
                User email
              </label>
              <Input
                id="filter-email"
                placeholder="user@example.com"
                value={userEmailFilter}
                onChange={(e) => setUserEmailFilter(e.target.value)}
                data-testid="admin-consent-audit-filter-email"
              />
            </div>
            <div>
              <label htmlFor="filter-version" className="text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
                Policy version
              </label>
              <Input
                id="filter-version"
                placeholder="2026-05-19"
                value={policyVersionFilter}
                onChange={(e) => setPolicyVersionFilter(e.target.value)}
                data-testid="admin-consent-audit-filter-version"
              />
            </div>
            <div className="flex items-end gap-2">
              <Button onClick={applyFilters} data-testid="admin-consent-audit-apply">
                Apply
              </Button>
              <Button variant="outline" onClick={clearFilters} data-testid="admin-consent-audit-clear">
                Clear
              </Button>
              <Button variant="ghost" onClick={() => refetch()} data-testid="admin-consent-audit-refresh">
                Refresh
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="py-5">
          <div className="flex items-center justify-between">
            <h2 className="font-headline text-lg">Records</h2>
            <span className="text-xs text-on-surface-variant" data-testid="admin-consent-audit-count">
              {records.length} {records.length === 1 ? "record" : "records"}
            </span>
          </div>
          {isLoading ? (
            <p className="mt-3 text-sm text-on-surface-variant" role="status">
              Loading…
            </p>
          ) : isError ? (
            <p className="mt-3 text-sm text-destructive" role="alert">
              Couldn't load consent records.
            </p>
          ) : records.length === 0 ? (
            <p className="mt-3 text-sm text-on-surface-variant" role="status" data-testid="admin-consent-audit-empty">
              No consent records match your filters.
            </p>
          ) : (
            <div className="mt-3 overflow-x-auto">
              <Table data-testid="admin-consent-audit-table">
                <TableHeader>
                  <TableRow>
                    <TableHead>Date &amp; time</TableHead>
                    <TableHead>User email</TableHead>
                    <TableHead>Policy version</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>IP</TableHead>
                    <TableHead>Device</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {records.map((row) => {
                    const isCurrent = currentVersion && row.policyVersion === currentVersion;
                    return (
                      <TableRow key={row.id} data-testid={`admin-consent-audit-row-${row.id}`}>
                        <TableCell className="whitespace-nowrap text-xs">
                          {new Date(row.consentedAt).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-xs">{row.userEmail}</TableCell>
                        <TableCell className="font-mono text-xs">{row.policyVersion}</TableCell>
                        <TableCell>
                          {isCurrent ? (
                            <Badge variant="default">Current</Badge>
                          ) : (
                            <Badge variant="secondary">Superseded</Badge>
                          )}
                        </TableCell>
                        <TableCell className="font-mono text-xs">{row.ipAddress ?? "—"}</TableCell>
                        <TableCell className="max-w-[280px] truncate text-xs text-on-surface-variant" title={row.userAgent ?? undefined}>
                          {row.userAgent ?? "—"}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
