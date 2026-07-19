// zone: Home
// persona: Owner
//
// #342 (WS3) — Portal "My Consents" page. Renders the caller's own consent
// history (newest first) for transparency. Each row shows policy version,
// date/time, IP, and a coarse user-agent (the owner sees their own raw
// values — no masking for self-view).
//
// Route: /portal/privacy/my-consents (registered in App.tsx).

import { useQuery } from "@tanstack/react-query";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ShieldCheck } from "lucide-react";
import { PortalShell, usePortalContext } from "./portal-shell";
import "@/styles/portal-redesign.css";

type ConsentRow = {
  id: string;
  policyVersion: string;
  consentedAt: string;
  ipAddress: string | null;
  userAgent: string | null;
};

type ConsentHistoryResponse = {
  currentPolicyVersion: string;
  records: ConsentRow[];
};

function PortalMyConsentsContent() {
  const { portalFetch, session } = usePortalContext();

  const { data, isLoading, isError } = useQuery<ConsentHistoryResponse>({
    queryKey: ["portal/consent/history", session.id],
    queryFn: async () => {
      const res = await portalFetch("/api/portal/consent/history");
      if (!res.ok) throw new Error("Failed to load consent history");
      return res.json();
    },
  });

  const records = data?.records ?? [];
  const currentVersion = data?.currentPolicyVersion;

  return (
    <div className="pfx-scope mx-auto flex max-w-4xl flex-col gap-6" data-testid="portal-my-consents">
      <section className="pfx-pagehead">
        <p className="pfx-eyebrow">Privacy</p>
        <h1 data-testid="portal-my-consents-heading">
          My consent history
        </h1>
        <p className="pfx-lede">
          A full record of every time you agreed to our Privacy Policy or Terms of Service.
          We keep this so you and your community have an evidence trail. Bumping the policy
          version triggers a fresh agreement on your next sign-in.
        </p>
      </section>

      <Card style={{ borderRadius: "var(--ds-radius, 12px)", boxShadow: "var(--ds-shadow, 0 1px 3px rgba(1,77,74,.04))" }}>
        <CardContent className="py-5">
          <div className="flex items-start gap-4">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl" style={{ background: "var(--ds-infosoft, #bfe8e4)" }}>
              <ShieldCheck className="h-5 w-5" style={{ color: "var(--ds-teal, #014d4a)" }} aria-hidden="true" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="pfx-eyebrow" style={{ fontSize: "10px" }}>
                Current policy version
              </p>
              <p className="mt-1 font-headline text-xl" style={{ color: "var(--ds-teal, #014d4a)" }} data-testid="portal-current-policy-version">
                {currentVersion ?? "—"}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card style={{ borderRadius: "var(--ds-radius, 12px)", boxShadow: "var(--ds-shadow, 0 1px 3px rgba(1,77,74,.04))" }}>
        <CardContent className="py-5">
          <h2 className="font-headline text-lg">Your agreements</h2>
          {isLoading ? (
            <p className="mt-3 text-sm text-on-surface-variant" role="status">
              Loading your consent history…
            </p>
          ) : isError ? (
            <p className="mt-3 text-sm text-destructive" role="alert">
              Couldn't load your consent history. Please refresh and try again.
            </p>
          ) : records.length === 0 ? (
            <p className="mt-3 text-sm text-on-surface-variant" role="status" data-testid="portal-my-consents-empty">
              No consent records yet. The next time you sign in we'll capture your agreement.
            </p>
          ) : (
            <div className="mt-3 overflow-x-auto">
              <Table data-testid="portal-my-consents-table">
                <TableHeader>
                  <TableRow>
                    <TableHead>Date &amp; time</TableHead>
                    <TableHead>Policy version</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>From</TableHead>
                    <TableHead>Device</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {records.map((row) => {
                    const isCurrent = currentVersion && row.policyVersion === currentVersion;
                    return (
                      <TableRow key={row.id} data-testid={`portal-my-consents-row-${row.id}`}>
                        <TableCell className="whitespace-nowrap">
                          {new Date(row.consentedAt).toLocaleString()}
                        </TableCell>
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

export default function PortalMyConsentsPage() {
  useDocumentTitle("My consents — YCM");
  return (
    <PortalShell>
      <PortalMyConsentsContent />
    </PortalShell>
  );
}

export { PortalMyConsentsContent };
