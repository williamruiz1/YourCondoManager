// zone: Financials → Setup → Bank Accounts
// persona: Manager, Board Officer, Assisted Board, PM Assistant
//
// Admin-side Plaid bank connection management for the association.
// Owners pay via the portal-side flow (see portal-finances.tsx); this page
// is for HOA-scope (associationId-scoped, portalAccessId NULL) accounts.

import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { usePlaidLink } from "react-plaid-link";
import type {
  PlaidLinkOnSuccess,
  PlaidLinkOnSuccessMetadata,
  PlaidLinkOnExit,
  PlaidLinkError,
  PlaidLinkOnExitMetadata,
} from "react-plaid-link";
import { apiRequest } from "@/lib/queryClient";
import {
  isPlaidOAuthReturn,
  readSavedOAuthToken,
  saveOAuthToken,
  clearOAuthToken,
} from "@/lib/plaid-oauth";
import { collectFinancialConnections } from "@/lib/stripe-fc-link";
import { useActiveAssociation } from "@/hooks/use-active-association";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/empty-state";
import { WorkspacePageHeader } from "@/components/workspace-page-header";
import { Landmark, RefreshCw } from "lucide-react";
import type { BankAccount } from "@shared/schema";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type ConnectedAccount = BankAccount & { lastSyncedAt: string | null };

// ── Consolidated reconciliation ledger (matches the server's
//    /api/admin/reconciliation/transactions shape) ───────────────────────────
type ReconTxStatus = "auto-matched" | "suggested" | "needs-review" | "unmatched";

type ReconOwnerCandidate = {
  personId: string;
  personName: string;
  unitId: string;
  unitNumber: string | null;
  confidence: number;
};

type ReconTransactionRow = {
  bankTransactionId: string;
  date: string;
  descriptor: string;
  amountCents: number;
  status: ReconTxStatus;
  identifiedAs: {
    personId: string | null;
    personName: string | null;
    unitId: string | null;
    unitNumber: string | null;
  };
  forLabel: string | null;
  confidence: number | null;
  ledgerEntryId: string | null;
  ownerCandidates: ReconOwnerCandidate[];
};

type ReconTransactionLedger = {
  associationId: string;
  windowDays: number;
  rows: ReconTransactionRow[];
  counts: {
    total: number;
    autoMatched: number;
    suggested: number;
    needsReview: number;
    unmatched: number;
    nonOwnerIncome?: number;
  };
};

// Full owner roster (all owners of the association) — powers the
// "choose a different owner" attribution dropdown.
type AssociationOwner = {
  personId: string;
  personName: string;
  unitId: string;
  unitNumber: string | null;
};

type StatusFilter = "all" | "auto-matched" | "suggested" | "needs-review" | "unmatched";

function formatDate(value: string | Date | null | undefined) {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString();
}

function formatMoney(cents: number | null | undefined) {
  if (typeof cents !== "number") return "—";
  // Thousands separators + 2 decimals, e.g. $12,345.67 (and -$1,200.00 for debits).
  const dollars = cents / 100;
  return dollars.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

// Render the bank account type as a human label. Providers (Plaid / Stripe FC)
// return raw values like `depository` / `checking` / `savings`; we show
// "Checking" / "Savings" and drop the noisy "depository" container prefix.
function formatAccountType(type: string | null | undefined, subtype: string | null | undefined) {
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
  const t = (type ?? "").trim().toLowerCase();
  const st = (subtype ?? "").trim().toLowerCase();
  // The meaningful label is the subtype (checking/savings); `depository` is just
  // the container. Prefer the subtype; only fall back to the type when no subtype.
  if (st) return cap(st);
  if (t && t !== "depository") return cap(t);
  if (t === "depository") return "Bank account";
  return "—";
}

// Plain-English label + badge styling per status.
const STATUS_META: Record<
  ReconTxStatus,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline"; className: string }
> = {
  "auto-matched": {
    label: "Auto-matched",
    variant: "outline",
    className: "border-green-500 text-green-700",
  },
  suggested: {
    label: "Suggested — confirm",
    variant: "outline",
    className: "border-amber-500 text-amber-700",
  },
  "needs-review": {
    label: "Needs you",
    variant: "outline",
    className: "border-red-500 text-red-700",
  },
  unmatched: {
    label: "Unmatched",
    variant: "outline",
    className: "text-on-surface-variant",
  },
};

export default function FinancialBankConnectionsPage() {
  useDocumentTitle("Bank Accounts — YCM");
  const { activeAssociationId, activeAssociationName } = useActiveAssociation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [linkToken, setLinkToken] = useState<string | null>(null);

  // Which bank-feed provider is active server-side. When "stripe_fc" (the
  // STRIPE_FINANCIAL_CONNECTIONS_ENABLED flag is ON), the Connect button runs
  // the Stripe Financial Connections hosted flow instead of Plaid Link. When
  // "plaid" (the default), everything below behaves exactly as before.
  const { data: bankFeedProviderInfo } = useQuery<{
    provider: "plaid" | "stripe_fc";
    fc: { publishableKey: string | null } | null;
  }>({
    queryKey: ["/api/bank-feed/provider"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/bank-feed/provider");
      return res.json();
    },
  });
  const useStripeFc = bankFeedProviderInfo?.provider === "stripe_fc";

  // OAuth round-trip state. `oauthReturn` is captured once at first render from
  // the URL (it's a redirect-return navigation), and `receivedRedirectUri` is
  // the full return URL that Plaid Link needs to resume the OAuth session.
  const [oauthReturn] = useState<boolean>(() => isPlaidOAuthReturn());
  const [receivedRedirectUri, setReceivedRedirectUri] = useState<string | undefined>(
    () => (isPlaidOAuthReturn() && typeof window !== "undefined" ? window.location.href : undefined),
  );

  // On an OAuth return, restore the link_token we saved before the hand-off so
  // usePlaidLink can resume the SAME Link session. Runs once on mount.
  useEffect(() => {
    if (!oauthReturn) return;
    const saved = readSavedOAuthToken();
    if (saved) {
      setLinkToken(saved);
    } else {
      // Token vanished (cleared / different device / private mode). Can't resume
      // OAuth — surface it instead of opening an empty Link.
      toast({
        title: "Couldn't finish bank connection",
        description:
          "The Plaid session expired during the bank redirect. Please click Connect Bank Account to start again.",
        variant: "destructive",
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount
  }, []);

  const { data: accounts = [], isLoading: accountsLoading } = useQuery<ConnectedAccount[]>({
    queryKey: ["/api/plaid/accounts", activeAssociationId],
    queryFn: async () => {
      if (!activeAssociationId) return [];
      const res = await apiRequest("GET", `/api/plaid/accounts?associationId=${encodeURIComponent(activeAssociationId)}`);
      return res.json();
    },
    enabled: Boolean(activeAssociationId),
  });

  // Consolidated reconciliation ledger — ONE row per bank credit with full
  // identification (owner + unit + status + confidence), built server-side by
  // composing the existing auto-matcher engine output. Replaces the old
  // duplicate "raw transactions" + "pending reconciliation" lists.
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const {
    data: reconLedger,
    isLoading: reconLoading,
  } = useQuery<ReconTransactionLedger>({
    queryKey: ["/api/admin/reconciliation/transactions", activeAssociationId],
    queryFn: async () => {
      if (!activeAssociationId)
        return {
          associationId: "",
          windowDays: 30,
          rows: [],
          counts: { total: 0, autoMatched: 0, suggested: 0, needsReview: 0, unmatched: 0, nonOwnerIncome: 0 },
        };
      const res = await apiRequest(
        "GET",
        `/api/admin/reconciliation/transactions?associationId=${encodeURIComponent(activeAssociationId)}`,
      );
      return res.json();
    },
    enabled: Boolean(activeAssociationId),
  });
  // Full owner roster — the complete directory for the "choose a different
  // owner" attribution dropdown (not just the name-scored candidates).
  const { data: ownerRoster } = useQuery<{ owners: AssociationOwner[] }>({
    queryKey: ["/api/admin/reconciliation/owners", activeAssociationId],
    queryFn: async () => {
      if (!activeAssociationId) return { owners: [] };
      const res = await apiRequest(
        "GET",
        `/api/admin/reconciliation/owners?associationId=${encodeURIComponent(activeAssociationId)}`,
      );
      return res.json();
    },
    enabled: Boolean(activeAssociationId),
  });
  const owners = ownerRoster?.owners ?? [];

  // Review-queue ordering: clean/high-confidence suggested matches first,
  // ambiguous "needs you" next, no-name noise last, already-resolved
  // auto-matched sink to the bottom. Within a group, higher confidence (then
  // larger amount) first — so the treasurer resolves the easy wins top-down.
  const STATUS_RANK: Record<ReconTxStatus, number> = {
    suggested: 0,
    "needs-review": 1,
    unmatched: 2,
    "auto-matched": 3,
  };
  const rawReconRows = reconLedger?.rows ?? [];
  const reconRows = [...rawReconRows].sort((a, b) => {
    const ra = STATUS_RANK[a.status];
    const rb = STATUS_RANK[b.status];
    if (ra !== rb) return ra - rb;
    const ca = a.confidence ?? 0;
    const cb = b.confidence ?? 0;
    if (ca !== cb) return cb - ca;
    return b.amountCents - a.amountCents;
  });
  const filteredReconRows =
    statusFilter === "all" ? reconRows : reconRows.filter((r) => r.status === statusFilter);

  // Running tally: of the total dollars sitting unmatched, how much the engine
  // can resolve to an owner right now (suggested + needs-review carry an owner
  // path). No-name "unmatched" deposits need manual attribution.
  const centsByStatus = (status: ReconTxStatus) =>
    reconRows.filter((r) => r.status === status).reduce((s, r) => s + r.amountCents, 0);
  const suggestedCents = centsByStatus("suggested");
  const needsReviewCents = centsByStatus("needs-review");
  const unmatchedCents = centsByStatus("unmatched");
  const resolvableCents = suggestedCents + needsReviewCents;
  const totalOpenCents = resolvableCents + unmatchedCents;

  const createLinkToken = useMutation({
    mutationFn: async () => {
      if (!activeAssociationId) throw new Error("Select an association first");
      const res = await apiRequest("POST", "/api/plaid/create-link-token", { associationId: activeAssociationId });
      return res.json() as Promise<{ linkToken: string }>;
    },
    onSuccess: (data) => {
      // Persist the token BEFORE Link opens so it survives an OAuth redirect
      // round-trip (the bank hand-off reloads the page). Non-OAuth banks never
      // redirect, so the token is simply cleared on success/exit below.
      saveOAuthToken(data.linkToken);
      setLinkToken(data.linkToken);
    },
    onError: (err: Error) => toast({ title: "Could not start Plaid Link", description: err.message, variant: "destructive" }),
  });

  const exchangeToken = useMutation({
    mutationFn: async (input: { publicToken: string; institutionName: string | null }) => {
      if (!activeAssociationId) throw new Error("Select an association first");
      const res = await apiRequest("POST", "/api/plaid/exchange-token", {
        associationId: activeAssociationId,
        publicToken: input.publicToken,
        institutionName: input.institutionName,
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Bank connected" });
      clearOAuthToken();
      setLinkToken(null);
      qc.invalidateQueries({ queryKey: ["/api/plaid/accounts", activeAssociationId] });
    },
    onError: (err: Error) => toast({ title: "Connection failed", description: err.message, variant: "destructive" }),
  });

  // Stripe Financial Connections connect flow (used when useStripeFc). Mirrors
  // the Plaid createLinkToken → Link → exchange-token sequence, but the FC
  // hosted modal handles the bank OAuth (incl. Chase) inline, so there is no
  // redirect-return plumbing: create session → collect → exchange session id.
  const connectStripeFc = useMutation({
    mutationFn: async () => {
      if (!activeAssociationId) throw new Error("Select an association first");
      const publishableKey = bankFeedProviderInfo?.fc?.publishableKey;
      if (!publishableKey) {
        throw new Error("Stripe publishable key is not configured on the server");
      }
      // 1. Create the FC session (server returns the client_secret as linkToken).
      const tokenRes = await apiRequest("POST", "/api/plaid/create-link-token", {
        associationId: activeAssociationId,
      });
      const { linkToken: clientSecret } = (await tokenRes.json()) as { linkToken: string };
      // 2. Run the hosted FC collection flow (lazy-loads Stripe.js).
      const { sessionId, institutionName } = await collectFinancialConnections(
        publishableKey,
        clientSecret,
      );
      // 3. Exchange the FC session id (the FC provider's exchangePublicToken
      //    retrieves the session, subscribes the accounts, and persists the row).
      const res = await apiRequest("POST", "/api/plaid/exchange-token", {
        associationId: activeAssociationId,
        publicToken: sessionId,
        institutionName,
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Bank connected" });
      qc.invalidateQueries({ queryKey: ["/api/plaid/accounts", activeAssociationId] });
    },
    onError: (err: Error) =>
      toast({ title: "Connection failed", description: err.message, variant: "destructive" }),
  });

  const syncNow = useMutation({
    mutationFn: async () => {
      if (!activeAssociationId) throw new Error("Select an association first");
      const res = await apiRequest("POST", "/api/plaid/sync", { associationId: activeAssociationId });
      return res.json() as Promise<{ synced: number; connections: number }>;
    },
    onSuccess: (data) => {
      toast({ title: "Sync complete", description: `${data.synced} transactions across ${data.connections} connection(s).` });
      qc.invalidateQueries({ queryKey: ["/api/plaid/accounts", activeAssociationId] });
    },
    onError: (err: Error) => toast({ title: "Sync failed", description: err.message, variant: "destructive" }),
  });

  const disconnect = useMutation({
    mutationFn: async (connectionId: string) => {
      const res = await apiRequest("DELETE", `/api/plaid/connections/${connectionId}`);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Bank disconnected" });
      qc.invalidateQueries({ queryKey: ["/api/plaid/accounts", activeAssociationId] });
    },
    onError: (err: Error) => toast({ title: "Disconnect failed", description: err.message, variant: "destructive" }),
  });

  // Reconciliation engine mutations (the rich /api/admin/reconciliation/* path,
  // shared with the admin reconciliation surface). Each invalidates the
  // consolidated ledger so the table reflects the new state.
  const invalidateRecon = () => {
    qc.invalidateQueries({ queryKey: ["/api/admin/reconciliation/transactions", activeAssociationId] });
  };

  // Run the confidence-scored auto-matcher across every unmatched bank deposit.
  const reconcileAuto = useMutation({
    mutationFn: async () => {
      if (!activeAssociationId) throw new Error("Select an association first");
      const res = await apiRequest("POST", "/api/admin/reconciliation/auto-match", {
        associationId: activeAssociationId,
      });
      return res.json() as Promise<{ matched: unknown[]; needsManualReview: unknown[] }>;
    },
    onSuccess: (data) => {
      toast({
        title: "Auto-match complete",
        description: `${data.matched.length} matched · ${data.needsManualReview.length} need review.`,
      });
      invalidateRecon();
    },
    onError: (err: Error) => toast({ title: "Auto-match failed", description: err.message, variant: "destructive" }),
  });

  // "Suggested — confirm" rows: materialize the payment entry + auto-match it
  // (the engine also learns the descriptor alias for future deposits).
  const confirmSuggestion = useMutation({
    mutationFn: async (input: { bankTransactionId: string; personId: string; unitId: string }) => {
      if (!activeAssociationId) throw new Error("Select an association first");
      const res = await apiRequest("POST", "/api/admin/reconciliation/suggestions/create", {
        associationId: activeAssociationId,
        ...input,
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Payment recorded and matched" });
      invalidateRecon();
    },
    onError: (err: Error) =>
      toast({ title: "Confirm failed", description: err.message, variant: "destructive" }),
  });

  // "Needs you" rows: pair a bank credit with one of the candidate owners
  // (creates the payment entry + match in one step).
  const manualMatch = useMutation({
    mutationFn: async (input: { bankTransactionId: string; personId: string; unitId: string }) => {
      if (!activeAssociationId) throw new Error("Select an association first");
      const res = await apiRequest("POST", "/api/admin/reconciliation/suggestions/create", {
        associationId: activeAssociationId,
        ...input,
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Match applied" });
      invalidateRecon();
    },
    onError: (err: Error) =>
      toast({ title: "Match failed", description: err.message, variant: "destructive" }),
  });

  // "Not an owner payment": record a durable, reversible decision that a deposit
  // is non-owner income (bank interest / transfer / etc.). Moves NO money and
  // creates NO owner-ledger entry — the deposit simply leaves the review queue.
  const markNonOwnerIncome = useMutation({
    mutationFn: async (input: { bankTransactionId: string }) => {
      if (!activeAssociationId) throw new Error("Select an association first");
      const res = await apiRequest("POST", "/api/admin/reconciliation/mark-non-owner-income", {
        associationId: activeAssociationId,
        ...input,
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Marked as non-owner income", description: "Removed from the review queue. No payment recorded." });
      invalidateRecon();
    },
    onError: (err: Error) =>
      toast({ title: "Couldn't classify deposit", description: err.message, variant: "destructive" }),
  });

  const onPlaidSuccess = useCallback<PlaidLinkOnSuccess>(
    (publicToken: string, metadata: PlaidLinkOnSuccessMetadata) => {
      exchangeToken.mutate({
        publicToken,
        institutionName: metadata.institution?.name ?? null,
      });
    },
    [exchangeToken],
  );

  // Capture the REAL Plaid error on exit. Previously onExit just cleared the
  // token, so a Link failure surfaced to the user as a blank "Internal error
  // occurred" with no captured detail. Now we log + toast Plaid's actual
  // error_code / error_message / error_type, which is the discriminating data
  // for diagnosing any future Link failure.
  const onPlaidExit = useCallback<PlaidLinkOnExit>(
    (error: PlaidLinkError | null, metadata: PlaidLinkOnExitMetadata) => {
      if (error) {
        // eslint-disable-next-line no-console -- surface the real Plaid error for support/debugging
        console.error("[plaid][link][exit] error", {
          error_code: error.error_code,
          error_message: error.error_message,
          error_type: error.error_type,
          display_message: error.display_message,
          request_id: metadata?.request_id,
          link_session_id: metadata?.link_session_id,
        });
        toast({
          title: "Plaid Link couldn't finish",
          description:
            error.display_message ||
            error.error_message ||
            `${error.error_type ?? "ERROR"}: ${error.error_code ?? "unknown"}`,
          variant: "destructive",
        });
      }
      clearOAuthToken();
      setLinkToken(null);
    },
    [toast],
  );

  // `receivedRedirectUri` is passed ONLY on an OAuth return. On the initial
  // (non-return) Link open it MUST be undefined — passing it on a fresh open
  // makes the SDK try to resume a non-existent OAuth session. This single
  // usePlaidLink instance therefore serves BOTH paths: standard banks (no
  // receivedRedirectUri, no redirect) and OAuth banks (receivedRedirectUri set
  // after the round-trip).
  const { open: openPlaid, ready: plaidReady } = usePlaidLink({
    token: linkToken,
    onSuccess: onPlaidSuccess,
    onExit: onPlaidExit,
    ...(receivedRedirectUri ? { receivedRedirectUri } : {}),
  });

  // Auto-open Plaid Link exactly ONCE per fetched token, as soon as the SDK is
  // ready. The previous implementation called `setTimeout(open, 0)` directly in
  // the render body, so it scheduled an `open()` on EVERY re-render while
  // `linkToken && plaidReady` were truthy. React re-renders many times, so this
  // produced repeated open() calls — Plaid logged "call to open() but Link is
  // already open. This is a noop." and the churn surfaced as
  // "Something went wrong — Internal error occurred."
  //
  // The fix: a useEffect gated on (token, ready) that opens once and a ref that
  // records which token we've already opened, so a re-render (or a re-created
  // handler) cannot re-trigger open() for the same session.
  const openedForTokenRef = useRef<string | null>(null);
  useEffect(() => {
    if (!linkToken || !plaidReady) return;
    if (openedForTokenRef.current === linkToken) return;
    openedForTokenRef.current = linkToken;
    openPlaid();

    // On an OAuth return, strip the oauth_state_id / plaidOAuthReturn params
    // from the URL once Link has consumed them, so a later refresh of this page
    // doesn't re-enter return mode against a now-stale session.
    if (oauthReturn && typeof window !== "undefined") {
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [linkToken, plaidReady, openPlaid, oauthReturn]);

  // Reset the open-once guard + the received-redirect URI whenever the token is
  // cleared AFTER a session ran (on exit/success), so the next "Connect Bank
  // Account" click opens a fresh, NON-OAuth-return Link session.
  //
  // The `hadTokenRef` guard is load-bearing: on an OAuth return `linkToken`
  // starts null and is restored a tick later by the mount effect. Without this
  // guard, this effect would fire on that initial null and wipe
  // `receivedRedirectUri` BEFORE the restored token could use it, breaking the
  // OAuth resume. We only reset once a token has actually been set at least once.
  const hadTokenRef = useRef(false);
  useEffect(() => {
    if (linkToken) {
      hadTokenRef.current = true;
      return;
    }
    if (!hadTokenRef.current) return; // initial null (incl. pre-restore OAuth return) — don't reset
    if (!linkToken) {
      openedForTokenRef.current = null;
      setReceivedRedirectUri(undefined);
    }
  }, [linkToken]);

  const uniqueConnectionIds = Array.from(new Set(accounts.map((a) => a.bankConnectionId)));

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6" data-testid="financial-bank-connections">
      <WorkspacePageHeader
        title="Bank Accounts"
        summary={
          activeAssociationName
            ? `Manage Plaid-linked bank accounts for ${activeAssociationName}. This is the canonical reconciliation surface for HOAs with a connected bank.`
            : "Manage Plaid-linked bank accounts for the association. This is the canonical reconciliation surface for HOAs with a connected bank."
        }
      />

      {/* PRIMARY SURFACE — one consolidated, identified transaction table.
          Every bank credit is a single row that says WHO it's from, WHAT it's
          for, the engine's confidence, and its match status. Replaces the old
          two-raw-list duplication. */}
      <Card data-testid="reconciliation-ledger">
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle>Reconciliation</CardTitle>
            <CardDescription>
              Every bank deposit from the last {reconLedger?.windowDays ?? 30} days, identified
              against your owner ledger. Confirm the suggested matches and resolve anything that
              needs you.
            </CardDescription>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => reconcileAuto.mutate()}
            disabled={reconcileAuto.isPending || !activeAssociationId}
            data-testid="btn-auto-reconcile"
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${reconcileAuto.isPending ? "animate-spin" : ""}`} />
            {reconcileAuto.isPending ? "Matching…" : "Run auto-match"}
          </Button>
        </CardHeader>
        <CardContent>
          {/* Running tally — of the dollars sitting unmatched, how much the
              engine can resolve to an owner right now. */}
          {totalOpenCents > 0 ? (
            <div
              className="mb-4 rounded-md border border-outline-variant bg-surface-container p-3"
              data-testid="recon-tally"
            >
              <div className="text-sm">
                <span className="font-semibold" data-testid="tally-resolvable">
                  {formatMoney(resolvableCents)}
                </span>{" "}
                of{" "}
                <span className="font-semibold" data-testid="tally-total">
                  {formatMoney(totalOpenCents)}
                </span>{" "}
                resolvable
              </div>
              <div className="mt-1 text-xs text-on-surface-variant">
                {formatMoney(suggestedCents)} ready to confirm ·{" "}
                {formatMoney(needsReviewCents)} needs your review ·{" "}
                {formatMoney(unmatchedCents)} unidentified
                {reconLedger?.counts.nonOwnerIncome
                  ? ` · ${reconLedger.counts.nonOwnerIncome} marked non-owner income`
                  : ""}
              </div>
            </div>
          ) : null}

          {/* Filter toggle — same rows, filtered (NOT a separate redundant list). */}
          {reconRows.length > 0 ? (
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <span className="text-sm text-on-surface-variant">Show:</span>
              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
                <SelectTrigger className="w-[220px]" data-testid="select-status-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    All deposits ({reconLedger?.counts.total ?? 0})
                  </SelectItem>
                  <SelectItem value="needs-review">
                    Needs you ({reconLedger?.counts.needsReview ?? 0})
                  </SelectItem>
                  <SelectItem value="suggested">
                    Suggested — confirm ({reconLedger?.counts.suggested ?? 0})
                  </SelectItem>
                  <SelectItem value="auto-matched">
                    Auto-matched ({reconLedger?.counts.autoMatched ?? 0})
                  </SelectItem>
                  <SelectItem value="unmatched">
                    Unmatched ({reconLedger?.counts.unmatched ?? 0})
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          ) : null}

          {reconLoading ? (
            <p className="text-sm text-on-surface-variant">Loading…</p>
          ) : reconRows.length === 0 ? (
            <EmptyState
              icon={Landmark}
              title="No bank deposits yet"
              description="Connect a bank account and click Sync Now to pull deposits, then they'll appear here identified against your owner ledger."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>From (bank descriptor)</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Identified as</TableHead>
                  <TableHead>For</TableHead>
                  <TableHead>Confidence</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredReconRows.map((row) => {
                  const meta = STATUS_META[row.status];
                  const topCandidate = row.ownerCandidates[0];
                  return (
                    <TableRow key={row.bankTransactionId} data-testid={`recon-row-${row.bankTransactionId}`}>
                      <TableCell className="text-xs">{formatDate(row.date)}</TableCell>
                      <TableCell className="max-w-xs truncate" title={row.descriptor}>
                        {row.descriptor}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatMoney(row.amountCents)}
                      </TableCell>
                      <TableCell>
                        {row.identifiedAs.personName ? (
                          <span>
                            <span className="font-medium">{row.identifiedAs.personName}</span>
                            {row.identifiedAs.unitNumber ? (
                              <span className="text-on-surface-variant"> · #{row.identifiedAs.unitNumber}</span>
                            ) : null}
                          </span>
                        ) : row.status === "needs-review" && row.ownerCandidates.length > 0 ? (
                          <span className="text-xs text-on-surface-variant">
                            Ambiguous:{" "}
                            {row.ownerCandidates
                              .slice(0, 3)
                              .map((c) => `${c.personName} (${(c.confidence * 100).toFixed(0)}%)`)
                              .join(" / ")}
                          </span>
                        ) : (
                          <span className="text-on-surface-variant">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {row.forLabel ? (
                          <span className="text-xs">{row.forLabel}</span>
                        ) : (
                          <span className="text-on-surface-variant">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {typeof row.confidence === "number" ? (
                          <span className="text-xs">
                            {(row.confidence * 100).toFixed(0)}%
                            {row.confidence >= 0.99 ? " ✓" : ""}
                          </span>
                        ) : row.status === "auto-matched" ? (
                          <span className="text-xs text-green-700">✓</span>
                        ) : (
                          <span className="text-on-surface-variant">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={meta.variant} className={meta.className}>
                          {meta.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {row.status === "auto-matched" ? (
                          <span className="text-xs text-on-surface-variant">Recorded</span>
                        ) : (
                          <div className="flex flex-col items-start gap-1.5">
                            {/* Confirm the engine's suggested match (top candidate). */}
                            {row.status === "suggested" && topCandidate ? (
                              <Button
                                size="sm"
                                disabled={confirmSuggestion.isPending}
                                onClick={() =>
                                  confirmSuggestion.mutate({
                                    bankTransactionId: row.bankTransactionId,
                                    personId: topCandidate.personId,
                                    unitId: topCandidate.unitId,
                                  })
                                }
                                data-testid={`btn-confirm-${row.bankTransactionId}`}
                              >
                                Confirm {topCandidate.personName}
                              </Button>
                            ) : null}

                            {/* Choose a different owner — full association roster. */}
                            <Select
                              value=""
                              onValueChange={(encoded) => {
                                const [personId, unitId] = encoded.split("::");
                                if (!personId || !unitId) return;
                                manualMatch.mutate({
                                  bankTransactionId: row.bankTransactionId,
                                  personId,
                                  unitId,
                                });
                              }}
                            >
                              <SelectTrigger
                                className="h-8 w-[210px]"
                                data-testid={`select-owner-${row.bankTransactionId}`}
                                disabled={manualMatch.isPending || owners.length === 0}
                              >
                                <SelectValue
                                  placeholder={
                                    row.status === "suggested"
                                      ? "Choose a different owner…"
                                      : "Match to owner…"
                                  }
                                />
                              </SelectTrigger>
                              <SelectContent>
                                {owners.map((o) => (
                                  <SelectItem
                                    key={`${o.personId}::${o.unitId}`}
                                    value={`${o.personId}::${o.unitId}`}
                                  >
                                    {`${o.personName}${o.unitNumber ? ` · #${o.unitNumber}` : ""}`}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>

                            {/* Not an owner payment — bank interest / transfer / etc. */}
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 px-2 text-xs text-on-surface-variant"
                              disabled={markNonOwnerIncome.isPending}
                              onClick={() =>
                                markNonOwnerIncome.mutate({
                                  bankTransactionId: row.bankTransactionId,
                                })
                              }
                              data-testid={`btn-non-owner-${row.bankTransactionId}`}
                            >
                              Not an owner payment
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Accounts (connected banks) — connect/sync flow preserved verbatim. */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Connected Banks</CardTitle>
            <CardDescription>Live association-owned accounts. Owners' payment-only connections live in the owner portal and are not shown here.</CardDescription>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => syncNow.mutate()}
              disabled={syncNow.isPending || accounts.length === 0}
              data-testid="btn-sync-now"
            >
              {syncNow.isPending ? "Syncing…" : "Sync Now"}
            </Button>
            <Button
              onClick={() => (useStripeFc ? connectStripeFc.mutate() : createLinkToken.mutate())}
              disabled={
                (useStripeFc ? connectStripeFc.isPending : createLinkToken.isPending) ||
                !activeAssociationId
              }
              data-testid="btn-connect-bank"
            >
              {(useStripeFc ? connectStripeFc.isPending : createLinkToken.isPending)
                ? "Opening…"
                : "Connect Bank Account"}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {accountsLoading ? (
            <p className="text-sm text-on-surface-variant">Loading…</p>
          ) : accounts.length === 0 ? (
            <EmptyState
              icon={Landmark}
              title="No bank accounts connected yet"
              description="Click Connect Bank Account to link your association's bank via Plaid."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Account</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Last 4</TableHead>
                  <TableHead className="text-right">Current balance</TableHead>
                  <TableHead>Last synced</TableHead>
                  <TableHead aria-label="Actions" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {accounts.map((acct) => (
                  <TableRow key={acct.id} data-testid={`bank-account-row-${acct.id}`}>
                    <TableCell className="font-medium">{acct.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {formatAccountType(acct.type, acct.subtype)}
                      </Badge>
                    </TableCell>
                    <TableCell>{acct.mask ? `••${acct.mask}` : "—"}</TableCell>
                    <TableCell className="text-right">{formatMoney(acct.currentBalanceCents)}</TableCell>
                    <TableCell className="text-xs text-on-surface-variant">{formatDate(acct.lastSyncedAt)}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => disconnect.mutate(acct.bankConnectionId)}
                        disabled={disconnect.isPending}
                        data-testid={`btn-disconnect-${acct.id}`}
                      >
                        Disconnect
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {uniqueConnectionIds.length > 0 ? (
            <p className="mt-3 text-xs text-on-surface-variant">
              {uniqueConnectionIds.length} active connection(s).
            </p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
