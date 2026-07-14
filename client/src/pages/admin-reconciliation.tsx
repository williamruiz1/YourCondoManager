// zone: Financials / Platform
// persona: Platform Admin, Manager, Board Officer, Assisted Board, PM Assistant
//
// /app/admin/reconciliation — Reconciliation surface for founder-os#970 Gap C.
//
// What this page does, plain-English (per OP #19):
//   The board admin opens this page to answer "did every dollar that hit our
//   bank account this month show up correctly in our owner ledger?" Tab 1 is
//   the working-surface for unmatched transactions (with one-click match and
//   a confidence-scored auto-matcher). Tab 2 is the dollar-level summary for
//   the chosen period. Tab 3 is the audit log of every match decision —
//   automatic or manual.
//
// Server endpoints consumed:
//   GET  /api/admin/reconciliation/report        — summary + per-owner breakdown
//   POST /api/admin/reconciliation/auto-match    — run the auto-matcher (idempotent)
//   GET  /api/admin/reconciliation/manual-queue  — unmatched bank tx ↔ candidate list
//   POST /api/admin/reconciliation/match         — explicit manual pairing
//   GET  /api/admin/reconciliation/audit-log     — match history
//
// Cross-link: server/services/reconciliation/auto-matcher.ts (algorithm) +
// server/routes/admin-reconciliation.ts (endpoint wiring).

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useActiveAssociation } from "@/hooks/use-active-association";
import { WorkspacePageHeader } from "@/components/workspace-page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Pill } from "@ycm/design-system";
import "@/styles/redesign-kit.css";
import "@/styles/financial-redesign.css";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  ArrowRight,
  Building2,
  Lock,
  LockOpen,
  CalendarCheck,
} from "lucide-react";

// ── Wire-shape (matches what the server returns) ─────────────────────────────

interface ReportTotals {
  bankDepositsCents: number;
  ledgerPaymentsCents: number;
  matchedCount: number;
  unmatchedBankTxCount: number;
  unmatchedLedgerEntryCount: number;
  gapCents: number;
}
// Month-close view (YCM#220 — treasurer period-close workflow).
interface MonthCloseState {
  associationId: string;
  periodMonth: string;
  periodStart: string;
  periodEnd: string;
  matchedCount: number;
  unmatchedBankTxCount: number;
  unmatchedLedgerEntryCount: number;
  unmatchedTotal: number;
  unmatchedBankTransactions: Array<{
    id: string;
    date: string;
    name: string;
    merchantName: string | null;
    amountCents: number;
  }>;
  unmatchedLedgerEntries: Array<{
    id: string;
    personName: string;
    unitNumber: string | null;
    postedAt: string;
    amount: number;
    description: string | null;
  }>;
  isClosed: boolean;
  close: {
    status: string;
    matchedCount: number;
    unmatchedBankTxCount: number;
    unmatchedLedgerEntryCount: number;
    closedByEmail: string;
    closedAt: string;
    reopenedByEmail: string | null;
    reopenedAt: string | null;
  } | null;
}

interface ReconciliationReport {
  associationId: string;
  periodStart: string;
  periodEnd: string;
  totals: ReportTotals;
  unmatchedBankTransactions: Array<{
    id: string;
    date: string;
    name: string;
    merchantName: string | null;
    amountCents: number;
  }>;
  unmatchedLedgerEntries: Array<{
    id: string;
    personId: string;
    personName: string;
    unitId: string;
    unitNumber: string | null;
    postedAt: string;
    amount: number;
    description: string | null;
  }>;
  byOwner: Array<{
    personId: string;
    personName: string;
    paymentsRecordedCents: number;
    paymentsSettledCents: number;
    gapCents: number;
  }>;
}

interface ManualQueueRow {
  bankTransactionId: string;
  reason: "low-confidence" | "ambiguous";
  candidates: Array<{
    ledgerEntryId: string;
    confidence: number;
    signals: {
      amountDeltaCents: number;
      dateDeltaDays: number;
      payorMatch: "exact" | "partial" | "none";
    };
  }>;
}

interface LegacyPending {
  unmatchedCredits: Array<{
    id: string;
    date: string;
    name: string;
    merchantName: string | null;
    amountCents: number;
    candidates: Array<{
      id: string;
      amount: number;
      description: string | null;
      createdAt: string;
    }>;
  }>;
  pendingEntryCount: number;
}

interface ManualQueueResponse {
  legacyPending: LegacyPending;
  autoMatcherReview: ManualQueueRow[];
}

interface OwnerSuggestionCandidate {
  personId: string;
  personName: string;
  unitId: string;
  unitNumber: string | null;
  openBalanceCents: number;
  payorMatch: "exact" | "partial" | "none";
  amountDeltaCents: number;
  confidence: number;
}
interface OwnerSuggestion {
  bankTransactionId: string;
  bankAmountCents: number;
  bankDate: string;
  bankDescription: string;
  ownerCandidates: OwnerSuggestionCandidate[];
  tier: "auto-create" | "review" | "ambiguous";
  topConfidence: number;
}
interface SuggestionsResponse {
  suggestions: OwnerSuggestion[];
}

interface AuditLogEntry {
  id: string;
  actorEmail: string;
  action: string;
  entityType: string;
  entityId: string | null;
  associationId: string | null;
  afterJson: any;
  createdAt: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function dollarFromCents(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  return `${sign}$${(Math.abs(cents) / 100).toFixed(2)}`;
}
function dollarFromAmount(amount: number): string {
  const sign = amount < 0 ? "-" : "";
  return `${sign}$${Math.abs(amount).toFixed(2)}`;
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function AdminReconciliationPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { activeAssociationId, activeAssociationName } = useActiveAssociation();
  const [tab, setTab] = useState("unmatched");

  // Period filter for the report (default: last 30 days)
  const today = new Date();
  const thirty = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
  const [periodStart, setPeriodStart] = useState(thirty.toISOString().slice(0, 10));
  const [periodEnd, setPeriodEnd] = useState(today.toISOString().slice(0, 10));

  // ── Suggestions queue (Tab "suggestions") ──────────────────────────────────
  const suggestionsQuery = useQuery<SuggestionsResponse>({
    queryKey: ["/api/admin/reconciliation/suggestions", activeAssociationId],
    queryFn: async () => {
      const res = await apiRequest(
        "GET",
        `/api/admin/reconciliation/suggestions?associationId=${activeAssociationId}`,
      );
      return res.json();
    },
    enabled: Boolean(activeAssociationId),
  });
  const suggestions = suggestionsQuery.data?.suggestions ?? [];
  const pendingSuggestionCount = suggestions.length;

  // Auto-dismissed locally (kept client-side; on Dismiss the row simply hides
  // until the next refetch, when the server-side query re-derives the list).
  const [dismissedBtxIds, setDismissedBtxIds] = useState<Set<string>>(new Set());
  const visibleSuggestions = suggestions.filter((s) => !dismissedBtxIds.has(s.bankTransactionId));

  // Suggestions tab becomes the landing default when there's at least one
  // pending suggestion AND the user hasn't yet selected another tab.
  const [hasUserSelectedTab, setHasUserSelectedTab] = useState(false);
  useEffect(() => {
    if (!hasUserSelectedTab && pendingSuggestionCount > 0) {
      setTab("suggestions");
    }
  }, [pendingSuggestionCount, hasUserSelectedTab]);

  // ── Manual queue (Tab 1) ───────────────────────────────────────────────────
  const queueQuery = useQuery<ManualQueueResponse>({
    queryKey: ["/api/admin/reconciliation/manual-queue", activeAssociationId],
    queryFn: async () => {
      const res = await apiRequest(
        "GET",
        `/api/admin/reconciliation/manual-queue?associationId=${activeAssociationId}`,
      );
      return res.json();
    },
    enabled: Boolean(activeAssociationId),
  });

  // ── Report (Tab 2) ─────────────────────────────────────────────────────────
  const reportQuery = useQuery<ReconciliationReport>({
    queryKey: [
      "/api/admin/reconciliation/report",
      activeAssociationId,
      periodStart,
      periodEnd,
    ],
    queryFn: async () => {
      const params = new URLSearchParams({
        associationId: String(activeAssociationId),
        periodStart,
        periodEnd,
      });
      const res = await apiRequest(
        "GET",
        `/api/admin/reconciliation/report?${params.toString()}`,
      );
      return res.json();
    },
    enabled: Boolean(activeAssociationId) && tab === "report",
  });

  // ── Audit log (Tab 3) ──────────────────────────────────────────────────────
  const auditQuery = useQuery<{ entries: AuditLogEntry[] }>({
    queryKey: ["/api/admin/reconciliation/audit-log", activeAssociationId],
    queryFn: async () => {
      const res = await apiRequest(
        "GET",
        `/api/admin/reconciliation/audit-log?associationId=${activeAssociationId}&limit=100`,
      );
      return res.json();
    },
    enabled: Boolean(activeAssociationId) && tab === "audit",
  });

  // ── Mutations ──────────────────────────────────────────────────────────────
  const autoMatchMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/reconciliation/auto-match", {
        associationId: activeAssociationId,
      });
      return res.json();
    },
    onSuccess: (data: { matched: any[]; needsManualReview: any[] }) => {
      toast({
        title: "Auto-match complete",
        description: `${data.matched.length} auto-matched · ${data.needsManualReview.length} need manual review`,
      });
      qc.invalidateQueries({ queryKey: ["/api/admin/reconciliation/manual-queue"] });
      qc.invalidateQueries({ queryKey: ["/api/admin/reconciliation/report"] });
      qc.invalidateQueries({ queryKey: ["/api/admin/reconciliation/audit-log"] });
    },
    onError: (err: any) => {
      toast({
        title: "Auto-match failed",
        description: err.message ?? "Unknown error",
        variant: "destructive",
      });
    },
  });

  const createSuggestionMutation = useMutation({
    mutationFn: async (input: {
      bankTransactionId: string;
      personId: string;
      unitId: string;
    }) => {
      const res = await apiRequest(
        "POST",
        "/api/admin/reconciliation/suggestions/create",
        {
          associationId: activeAssociationId,
          bankTransactionId: input.bankTransactionId,
          personId: input.personId,
          unitId: input.unitId,
        },
      );
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Payment entry created and matched" });
      qc.invalidateQueries({ queryKey: ["/api/admin/reconciliation/suggestions"] });
      qc.invalidateQueries({ queryKey: ["/api/admin/reconciliation/manual-queue"] });
      qc.invalidateQueries({ queryKey: ["/api/admin/reconciliation/report"] });
      qc.invalidateQueries({ queryKey: ["/api/admin/reconciliation/audit-log"] });
    },
    onError: (err: any) => {
      toast({
        title: "Create-from-suggestion failed",
        description: err.message ?? "Unknown error",
        variant: "destructive",
      });
    },
  });

  const matchMutation = useMutation({
    mutationFn: async (input: { bankTransactionId: string; ledgerEntryId: string }) => {
      const res = await apiRequest("POST", "/api/admin/reconciliation/match", {
        associationId: activeAssociationId,
        bankTransactionId: input.bankTransactionId,
        ledgerEntryId: input.ledgerEntryId,
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Matched" });
      qc.invalidateQueries({ queryKey: ["/api/admin/reconciliation/manual-queue"] });
      qc.invalidateQueries({ queryKey: ["/api/admin/reconciliation/report"] });
      qc.invalidateQueries({ queryKey: ["/api/admin/reconciliation/audit-log"] });
    },
    onError: (err: any) => {
      toast({
        title: "Match failed",
        description: err.message ?? "Unknown error",
        variant: "destructive",
      });
    },
  });

  // ── Month-close (Tab "close") ──────────────────────────────────────────────
  // Default to the previous calendar month (the one a treasurer typically
  // closes at the start of a new month), in the association's local view.
  const [closeMonth, setCloseMonth] = useState(() => {
    const d = new Date();
    d.setUTCDate(1);
    d.setUTCMonth(d.getUTCMonth() - 1);
    return d.toISOString().slice(0, 7); // YYYY-MM
  });
  const [confirmUnmatchedOpen, setConfirmUnmatchedOpen] = useState(false);

  const monthCloseQuery = useQuery<MonthCloseState>({
    queryKey: ["/api/admin/reconciliation/month-close", activeAssociationId, closeMonth],
    queryFn: async () => {
      const params = new URLSearchParams({
        associationId: String(activeAssociationId),
        month: closeMonth,
      });
      const res = await apiRequest(
        "GET",
        `/api/admin/reconciliation/month-close?${params.toString()}`,
      );
      return res.json();
    },
    enabled: Boolean(activeAssociationId) && tab === "close" && /^\d{4}-\d{2}$/.test(closeMonth),
  });

  const closeMonthMutation = useMutation({
    mutationFn: async (input: { acknowledgeUnmatched?: boolean }) => {
      const res = await apiRequest("POST", "/api/admin/reconciliation/month-close", {
        associationId: activeAssociationId,
        month: closeMonth,
        acknowledgeUnmatched: input.acknowledgeUnmatched === true,
      });
      // A 409 UNMATCHED_ACK_REQUIRED is surfaced as an error we intercept below.
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const err: any = new Error(body.error ?? "Close failed");
        err.code = body.code;
        err.detail = body.detail;
        throw err;
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: `${closeMonth} closed`, description: "Period attested and locked." });
      setConfirmUnmatchedOpen(false);
      qc.invalidateQueries({ queryKey: ["/api/admin/reconciliation/month-close"] });
      qc.invalidateQueries({ queryKey: ["/api/admin/reconciliation/audit-log"] });
    },
    onError: (err: any) => {
      if (err.code === "UNMATCHED_ACK_REQUIRED") {
        // Not a failure — open the confirm step acknowledging the count.
        setConfirmUnmatchedOpen(true);
        return;
      }
      toast({
        title: "Close failed",
        description: err.message ?? "Unknown error",
        variant: "destructive",
      });
    },
  });

  const reopenMonthMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/reconciliation/month-reopen", {
        associationId: activeAssociationId,
        month: closeMonth,
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: `${closeMonth} reopened` });
      qc.invalidateQueries({ queryKey: ["/api/admin/reconciliation/month-close"] });
      qc.invalidateQueries({ queryKey: ["/api/admin/reconciliation/audit-log"] });
    },
    onError: (err: any) => {
      toast({
        title: "Reopen failed",
        description: err.message ?? "Unknown error",
        variant: "destructive",
      });
    },
  });

  if (!activeAssociationId) {
    return (
      <div className="space-y-6 p-6 ds-scope fin-ds">
        <WorkspacePageHeader
        title="Reconciliation"
        summary="Auto-match bank deposits to owner ledger entries. Anything that can't be matched automatically lands here for one-click review."
      />
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            Select an association to view its reconciliation surface.
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Tab 1: Unmatched & manual-match ────────────────────────────────────────

  const queue = queueQuery.data;
  const legacyCredits = queue?.legacyPending.unmatchedCredits ?? [];
  const autoMatchReview = queue?.autoMatcherReview ?? [];

  // Build a flat candidate lookup for legacy credits (id → entry).
  const allCandidates = new Map<
    string,
    { id: string; amount: number; description: string | null; createdAt: string }
  >();
  for (const c of legacyCredits) {
    for (const cand of c.candidates) {
      allCandidates.set(cand.id, cand);
    }
  }

  function renderUnmatchedTab() {
    if (queueQuery.isLoading) {
      return (
        <div className="space-y-3">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      );
    }

    const hasAnything =
      legacyCredits.length > 0 || autoMatchReview.length > 0;

    return (
      <div className="space-y-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-base">Auto-matcher</CardTitle>
              <CardDescription>
                Run the confidence-scored matcher across every unmatched bank
                deposit. Auto-applies above 85% confidence; surfaces the rest
                below for manual review.
              </CardDescription>
            </div>
            <Button
              onClick={() => autoMatchMutation.mutate()}
              disabled={autoMatchMutation.isPending}
              data-testid="button-run-auto-match"
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${autoMatchMutation.isPending ? "animate-spin" : ""}`} />
              Run auto-match
            </Button>
          </CardHeader>
        </Card>

        {!hasAnything && (
          <Card>
            <CardContent className="py-10 text-center">
              <CheckCircle2 className="mx-auto mb-3 h-10 w-10 text-green-600" />
              <p className="text-sm text-muted-foreground">
                No unmatched bank transactions. Everything's accounted for.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Legacy pay-intent path (Issue #448) — kept intact for the Plaid
            sandbox payments (William's $1 + $5 today). */}
        {legacyCredits.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Plaid pay-intent reconciliation</CardTitle>
              <CardDescription>
                Bank deposits matched against pending Plaid-payment ledger
                entries (±$1 tolerance). Pick the right invoice and click
                Match.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Candidates</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {legacyCredits.map((credit) => (
                    <TableRow key={credit.id} data-testid={`row-credit-${credit.id}`}>
                      <TableCell className="text-xs">{credit.date}</TableCell>
                      <TableCell className="max-w-xs truncate" title={credit.name}>
                        {credit.merchantName ?? credit.name}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {dollarFromCents(Math.abs(credit.amountCents))}
                      </TableCell>
                      <TableCell>
                        {credit.candidates.length === 0 ? (
                          <span className="text-xs text-muted-foreground">
                            no ±$1 candidates
                          </span>
                        ) : (
                          <div className="flex flex-col gap-1">
                            {credit.candidates.map((cand) => (
                              <div
                                key={cand.id}
                                className="flex items-center justify-between gap-2 text-xs"
                              >
                                <span title={cand.description ?? ""}>
                                  {dollarFromAmount(Math.abs(cand.amount))}
                                  {" · "}
                                  {cand.description ?? "no description"}
                                </span>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled={matchMutation.isPending}
                                  onClick={() =>
                                    matchMutation.mutate({
                                      bankTransactionId: credit.id,
                                      ledgerEntryId: cand.id,
                                    })
                                  }
                                  data-testid={`button-match-${credit.id}-${cand.id}`}
                                >
                                  Match <ArrowRight className="ml-1 h-3 w-3" />
                                </Button>
                              </div>
                            ))}
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* New scored-candidate review (per auto-matcher) */}
        {autoMatchReview.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Scored review queue</CardTitle>
              <CardDescription>
                Bank deposits the auto-matcher couldn't confidently resolve.
                Each row shows the top candidate(s) with confidence + signals.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Bank tx</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Candidates</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {autoMatchReview.map((row) => (
                    <TableRow key={row.bankTransactionId} data-testid={`row-review-${row.bankTransactionId}`}>
                      <TableCell className="font-mono text-xs">
                        {row.bankTransactionId.slice(0, 8)}…
                      </TableCell>
                      <TableCell>
                        <Pill tone={row.reason === "ambiguous" ? "muted" : "info"}>
                          {row.reason}
                        </Pill>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          {row.candidates.map((c) => (
                            <div
                              key={c.ledgerEntryId}
                              className="flex items-center justify-between gap-2 text-xs"
                            >
                              <span>
                                {c.ledgerEntryId.slice(0, 8)}… · conf{" "}
                                <strong>{(c.confidence * 100).toFixed(0)}%</strong>
                                {" · "}
                                Δ{dollarFromCents(c.signals.amountDeltaCents)}
                                {" · "}
                                {c.signals.dateDeltaDays}d
                                {" · payor:"}
                                {c.signals.payorMatch}
                              </span>
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={matchMutation.isPending}
                                onClick={() =>
                                  matchMutation.mutate({
                                    bankTransactionId: row.bankTransactionId,
                                    ledgerEntryId: c.ledgerEntryId,
                                  })
                                }
                                data-testid={`button-review-match-${row.bankTransactionId}-${c.ledgerEntryId}`}
                              >
                                Match <ArrowRight className="ml-1 h-3 w-3" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  // ── Tab 2: Report ──────────────────────────────────────────────────────────

  function renderReportTab() {
    if (reportQuery.isLoading) {
      return (
        <div className="space-y-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      );
    }
    const r = reportQuery.data;
    if (!r) return null;

    const gapLabel =
      r.totals.gapCents === 0
        ? "Fully reconciled"
        : r.totals.gapCents > 0
          ? "Ledger ahead of bank"
          : "Bank ahead of ledger";

    return (
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Period</CardTitle>
            <CardDescription>
              Select the date range. Defaults to the last 30 days.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label className="block text-xs text-muted-foreground" htmlFor="period-start">
                  Start
                </label>
                <Input
                  id="period-start"
                  type="date"
                  value={periodStart}
                  onChange={(e) => setPeriodStart(e.target.value)}
                  data-testid="input-period-start"
                />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground" htmlFor="period-end">
                  End
                </label>
                <Input
                  id="period-end"
                  type="date"
                  value={periodEnd}
                  onChange={(e) => setPeriodEnd(e.target.value)}
                  data-testid="input-period-end"
                />
              </div>
              <Button
                variant="outline"
                onClick={() => reportQuery.refetch()}
                data-testid="button-refresh-report"
              >
                <RefreshCw className="mr-2 h-4 w-4" /> Refresh
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-3 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardDescription>Total bank deposits</CardDescription>
              <CardTitle data-testid="totals-bank-deposits">
                {dollarFromCents(r.totals.bankDepositsCents)}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <CardDescription>Total ledger payments</CardDescription>
              <CardTitle data-testid="totals-ledger-payments">
                {dollarFromCents(r.totals.ledgerPaymentsCents)}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <CardDescription>{gapLabel}</CardDescription>
              <CardTitle
                className={r.totals.gapCents === 0 ? "text-green-700" : "text-amber-600"}
                data-testid="totals-gap"
              >
                {dollarFromCents(Math.abs(r.totals.gapCents))}
              </CardTitle>
            </CardHeader>
          </Card>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardDescription>Matched</CardDescription>
              <CardTitle data-testid="totals-matched">{r.totals.matchedCount}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <CardDescription>Unmatched bank txs</CardDescription>
              <CardTitle data-testid="totals-unmatched-bank">
                {r.totals.unmatchedBankTxCount}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <CardDescription>Unmatched ledger entries</CardDescription>
              <CardTitle data-testid="totals-unmatched-ledger">
                {r.totals.unmatchedLedgerEntryCount}
              </CardTitle>
            </CardHeader>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Per-owner breakdown</CardTitle>
            <CardDescription>
              Recorded payments vs settled (matched-to-bank) payments per owner.
              Owners with a gap appear at the top.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {r.byOwner.length === 0 ? (
              <p className="text-sm text-muted-foreground">No payment entries in this period.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Owner</TableHead>
                    <TableHead className="text-right">Recorded</TableHead>
                    <TableHead className="text-right">Settled</TableHead>
                    <TableHead className="text-right">Gap</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {r.byOwner.map((o) => (
                    <TableRow key={o.personId} data-testid={`owner-row-${o.personId}`}>
                      <TableCell>{o.personName}</TableCell>
                      <TableCell className="text-right font-mono">
                        {dollarFromCents(o.paymentsRecordedCents)}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {dollarFromCents(o.paymentsSettledCents)}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {o.gapCents === 0 ? (
                          <Pill tone="ok">
                            $0
                          </Pill>
                        ) : (
                          <Pill tone="warn">{dollarFromCents(o.gapCents)}</Pill>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {r.unmatchedBankTransactions.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-amber-600" />
                Unmatched bank deposits in this period
              </CardTitle>
              <CardDescription>
                Bank credits hitting the account with no ledger entry pointing
                at them.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {r.unmatchedBankTransactions.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="text-xs">{t.date}</TableCell>
                      <TableCell className="max-w-md truncate" title={t.name}>
                        {t.merchantName ?? t.name}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {dollarFromCents(Math.abs(t.amountCents))}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  // ── Tab 4: Suggestions — descriptor-to-owner proposals ─────────────────────

  function renderSuggestionsTab() {
    if (suggestionsQuery.isLoading) {
      return (
        <div className="space-y-3">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      );
    }
    if (visibleSuggestions.length === 0) {
      return (
        <Card>
          <CardContent className="py-10 text-center">
            <CheckCircle2 className="mx-auto mb-3 h-10 w-10 text-green-600" />
            <p className="text-sm text-muted-foreground">
              No descriptor-based suggestions pending. Every unmatched deposit
              either has a clear ledger candidate (see Unmatched tab) or
              doesn't fingerprint to any owner by name.
            </p>
          </CardContent>
        </Card>
      );
    }

    return (
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Owner-attribution suggestions</CardTitle>
            <CardDescription>
              Bank deposits with no matching ledger entry, but whose descriptor
              fingerprints to an owner via first or last name + open-balance
              match. Click <strong>Create</strong> to materialize a payment
              ledger entry and auto-match it in one step.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Bank descriptor</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Tier</TableHead>
                  <TableHead>Proposed owner(s)</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleSuggestions.map((s) => (
                  <TableRow
                    key={s.bankTransactionId}
                    data-testid={`row-suggestion-${s.bankTransactionId}`}
                  >
                    <TableCell className="text-xs">{s.bankDate}</TableCell>
                    <TableCell className="max-w-xs truncate" title={s.bankDescription}>
                      {s.bankDescription}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {dollarFromCents(s.bankAmountCents)}
                    </TableCell>
                    <TableCell>
                      <Pill
                        tone={
                          s.tier === "auto-create"
                            ? "ok"
                            : s.tier === "ambiguous"
                              ? "bad"
                              : "muted"
                        }
                      >
                        {s.tier}
                      </Pill>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        {s.ownerCandidates.map((c) => (
                          <div key={c.personId} className="text-xs">
                            <span className="font-medium">{c.personName}</span>
                            {c.unitNumber && (
                              <span className="text-muted-foreground"> · #{c.unitNumber}</span>
                            )}
                            <span className="text-muted-foreground">
                              {" · bal "}
                              {dollarFromCents(c.openBalanceCents)}
                              {" · payor "}
                              {c.payorMatch}
                              {" · conf "}
                              <strong>{(c.confidence * 100).toFixed(0)}%</strong>
                            </span>
                          </div>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex flex-col items-end gap-1">
                        {s.tier !== "ambiguous" && s.ownerCandidates[0] && (
                          <Button
                            size="sm"
                            disabled={createSuggestionMutation.isPending}
                            onClick={() =>
                              createSuggestionMutation.mutate({
                                bankTransactionId: s.bankTransactionId,
                                personId: s.ownerCandidates[0].personId,
                                unitId: s.ownerCandidates[0].unitId,
                              })
                            }
                            data-testid={`button-suggestion-create-${s.bankTransactionId}`}
                          >
                            Create
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            setDismissedBtxIds(
                              (prev) => new Set([...prev, s.bankTransactionId]),
                            )
                          }
                          data-testid={`button-suggestion-dismiss-${s.bankTransactionId}`}
                        >
                          Dismiss
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Tab 3: Audit log ───────────────────────────────────────────────────────

  function renderCloseMonthTab() {
    const s = monthCloseQuery.data;
    return (
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Close the books for a month</CardTitle>
            <CardDescription>
              Confirm every bank transaction for the month is accounted for, then
              attest a close. A closed month records who closed it and when.
              Re-opening is an explicit action. This does not lock ledger entries —
              it is the treasurer's period attestation.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label className="block text-xs text-muted-foreground" htmlFor="close-month">
                  Month
                </label>
                <Input
                  id="close-month"
                  type="month"
                  value={closeMonth}
                  onChange={(e) => setCloseMonth(e.target.value)}
                  data-testid="input-close-month"
                />
              </div>
              <Button
                variant="outline"
                onClick={() => monthCloseQuery.refetch()}
                data-testid="button-refresh-close"
              >
                <RefreshCw className="mr-2 h-4 w-4" /> Refresh
              </Button>
            </div>
          </CardContent>
        </Card>

        {monthCloseQuery.isLoading && <Skeleton className="h-48 w-full" />}

        {s && (
          <>
            {s.isClosed && s.close && (
              <div
                className="flex items-center gap-2 rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800 dark:border-green-900 dark:bg-green-950 dark:text-green-300"
                data-testid="badge-month-closed"
              >
                <Lock className="h-4 w-4" />
                <span>
                  <strong>{s.periodMonth} is closed.</strong> Attested by{" "}
                  {s.close.closedByEmail} on{" "}
                  {new Date(s.close.closedAt).toLocaleString()}.
                </span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-muted-foreground">Matched</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-semibold" data-testid="text-matched-count">
                    {s.matchedCount}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-muted-foreground">
                    Unmatched
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div
                    className={`text-2xl font-semibold ${s.unmatchedTotal > 0 ? "text-amber-600" : ""}`}
                    data-testid="text-unmatched-count"
                  >
                    {s.unmatchedTotal}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {s.unmatchedBankTxCount} bank · {s.unmatchedLedgerEntryCount} ledger
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-muted-foreground">Period</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-sm">
                    {s.periodStart} → {s.periodEnd}
                  </div>
                </CardContent>
              </Card>
            </div>

            {s.unmatchedTotal > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <AlertCircle className="h-4 w-4 text-amber-600" />
                    Unmatched transactions ({s.unmatchedTotal})
                  </CardTitle>
                  <CardDescription>
                    These are still open for the month. You can close with known
                    stragglers, but you'll be asked to acknowledge the count.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Type</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {s.unmatchedBankTransactions.map((t) => (
                        <TableRow key={`bank-${t.id}`} data-testid={`row-unmatched-bank-${t.id}`}>
                          <TableCell>
                            <Pill tone="info">Bank</Pill>
                          </TableCell>
                          <TableCell>{t.date}</TableCell>
                          <TableCell>{t.merchantName ?? t.name}</TableCell>
                          <TableCell className="text-right">
                            {dollarFromCents(t.amountCents)}
                          </TableCell>
                        </TableRow>
                      ))}
                      {s.unmatchedLedgerEntries.map((e) => (
                        <TableRow key={`ledger-${e.id}`} data-testid={`row-unmatched-ledger-${e.id}`}>
                          <TableCell>
                            <Pill tone="muted">Ledger</Pill>
                          </TableCell>
                          <TableCell>{e.postedAt.slice(0, 10)}</TableCell>
                          <TableCell>
                            {e.personName}
                            {e.unitNumber ? ` · Unit ${e.unitNumber}` : ""}
                            {e.description ? ` — ${e.description}` : ""}
                          </TableCell>
                          <TableCell className="text-right">
                            {dollarFromAmount(e.amount)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}

            <div className="flex items-center gap-3">
              {s.isClosed ? (
                <Button
                  variant="outline"
                  onClick={() => reopenMonthMutation.mutate()}
                  disabled={reopenMonthMutation.isPending}
                  data-testid="button-reopen-month"
                >
                  <LockOpen className="mr-2 h-4 w-4" />
                  Re-open {s.periodMonth}
                </Button>
              ) : (
                <Button
                  onClick={() => closeMonthMutation.mutate({ acknowledgeUnmatched: false })}
                  disabled={closeMonthMutation.isPending}
                  data-testid="button-close-month"
                >
                  <CalendarCheck className="mr-2 h-4 w-4" />
                  Close {s.periodMonth}
                </Button>
              )}
              {s.unmatchedTotal === 0 && !s.isClosed && (
                <span className="flex items-center gap-1 text-sm text-green-700 dark:text-green-400">
                  <CheckCircle2 className="h-4 w-4" /> Fully reconciled
                </span>
              )}
            </div>
          </>
        )}

        {/* Confirm-on-unmatched step (soft guard, not a hard block). */}
        <AlertDialog open={confirmUnmatchedOpen} onOpenChange={setConfirmUnmatchedOpen}>
          <AlertDialogContent data-testid="dialog-confirm-unmatched">
            <AlertDialogHeader>
              <AlertDialogTitle>Close with unmatched transactions?</AlertDialogTitle>
              <AlertDialogDescription>
                {closeMonth} still has {s?.unmatchedTotal ?? 0} unmatched
                transaction(s). Closing now attests the period with these known
                stragglers still open. You can re-open the month later if needed.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel data-testid="button-confirm-cancel">Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => closeMonthMutation.mutate({ acknowledgeUnmatched: true })}
                data-testid="button-confirm-close-unmatched"
              >
                Acknowledge &amp; close
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
  }

  function renderAuditTab() {
    if (auditQuery.isLoading) {
      return <Skeleton className="h-48 w-full" />;
    }
    const entries = auditQuery.data?.entries ?? [];
    if (entries.length === 0) {
      return (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No reconciliation actions yet.
          </CardContent>
        </Card>
      );
    }
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Match history</CardTitle>
          <CardDescription>
            Every auto-match run + every manual pairing. Newest first.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Actor</TableHead>
                <TableHead>Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((e) => (
                <TableRow key={e.id} data-testid={`audit-row-${e.id}`}>
                  <TableCell className="text-xs">
                    {new Date(e.createdAt).toLocaleString()}
                  </TableCell>
                  <TableCell>
                    <Pill tone="muted">{e.action}</Pill>
                  </TableCell>
                  <TableCell className="text-xs">{e.actorEmail}</TableCell>
                  <TableCell className="text-xs font-mono">
                    {e.action === "reconciliation.auto-match.run"
                      ? `${e.afterJson?.matchedCount ?? 0} matched · ${e.afterJson?.needsManualReviewCount ?? 0} need review`
                      : e.afterJson?.bankTransactionId
                        ? `btx:${String(e.afterJson.bankTransactionId).slice(0, 8)}… → ole:${String(e.afterJson.ledgerEntryId ?? "").slice(0, 8)}…`
                        : ""}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6 p-6 ds-scope fin-ds">
      <WorkspacePageHeader
        title="Reconciliation"
        summary="Auto-match bank deposits to owner ledger entries. Anything that can't be matched automatically lands here for one-click review."
      />
      <div className="text-sm text-muted-foreground flex items-center gap-2">
        <Building2 className="h-4 w-4" />
        {activeAssociationName ?? "Active association"}
      </div>

      <Tabs
        value={tab}
        onValueChange={(value) => {
          setHasUserSelectedTab(true);
          setTab(value);
        }}
      >
        <TabsList>
          <TabsTrigger value="suggestions" data-testid="tab-suggestions">
            Suggestions
            {pendingSuggestionCount > 0 && (
              <span className="ml-2" data-testid="badge-suggestions-count">
                <Pill tone="info">
                  {pendingSuggestionCount}
                </Pill>
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="unmatched" data-testid="tab-unmatched">
            Unmatched
          </TabsTrigger>
          <TabsTrigger value="report" data-testid="tab-report">
            Report
          </TabsTrigger>
          <TabsTrigger value="close" data-testid="tab-close">
            Close month
          </TabsTrigger>
          <TabsTrigger value="audit" data-testid="tab-audit">
            Match history
          </TabsTrigger>
        </TabsList>
        <TabsContent value="suggestions" className="mt-4">
          {renderSuggestionsTab()}
        </TabsContent>
        <TabsContent value="unmatched" className="mt-4">
          {renderUnmatchedTab()}
        </TabsContent>
        <TabsContent value="report" className="mt-4">
          {renderReportTab()}
        </TabsContent>
        <TabsContent value="close" className="mt-4">
          {renderCloseMonthTab()}
        </TabsContent>
        <TabsContent value="audit" className="mt-4">
          {renderAuditTab()}
        </TabsContent>
      </Tabs>
    </div>
  );
}
