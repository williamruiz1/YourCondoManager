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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/empty-state";
import { WorkspacePageHeader } from "@/components/workspace-page-header";
import { Landmark, Receipt, AlertTriangle } from "lucide-react";
import type { BankAccount, BankTransaction } from "@shared/schema";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type ConnectedAccount = BankAccount & { lastSyncedAt: string | null };
type ConnectedTransaction = BankTransaction & { date: string };

type ReconciliationCandidate = {
  id: string;
  amount: number;
  description: string | null;
  createdAt: string;
};

type UnmatchedCredit = BankTransaction & {
  date: string;
  candidates: ReconciliationCandidate[];
};

type PendingReconciliationPayload = {
  unmatchedCredits: UnmatchedCredit[];
  pendingEntryCount: number;
};

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

  const { data: transactions = [] } = useQuery<ConnectedTransaction[]>({
    queryKey: ["/api/plaid/transactions", activeAssociationId],
    queryFn: async () => {
      if (!activeAssociationId) return [];
      const res = await apiRequest("GET", `/api/plaid/transactions?associationId=${encodeURIComponent(activeAssociationId)}`);
      return res.json();
    },
    enabled: Boolean(activeAssociationId),
  });

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

  // Issue #448 — bank-tx ↔ owner-ledger reconciliation.
  const { data: pendingRecon } = useQuery<PendingReconciliationPayload>({
    queryKey: ["/api/plaid/reconcile/pending", activeAssociationId],
    queryFn: async () => {
      if (!activeAssociationId) return { unmatchedCredits: [], pendingEntryCount: 0 };
      const res = await apiRequest(
        "GET",
        `/api/plaid/reconcile/pending?associationId=${encodeURIComponent(activeAssociationId)}`,
      );
      return res.json();
    },
    enabled: Boolean(activeAssociationId),
  });

  const reconcileAuto = useMutation({
    mutationFn: async () => {
      if (!activeAssociationId) throw new Error("Select an association first");
      const res = await apiRequest("POST", "/api/plaid/reconcile", { associationId: activeAssociationId });
      return res.json() as Promise<{ matched: Array<{ bankTransactionId: string; ledgerEntryId: string }> }>;
    },
    onSuccess: (data) => {
      toast({
        title: "Auto-reconcile complete",
        description: `${data.matched.length} match(es) applied.`,
      });
      qc.invalidateQueries({ queryKey: ["/api/plaid/reconcile/pending", activeAssociationId] });
      qc.invalidateQueries({ queryKey: ["/api/plaid/transactions", activeAssociationId] });
    },
    onError: (err: Error) => toast({ title: "Reconcile failed", description: err.message, variant: "destructive" }),
  });

  const manualMatch = useMutation({
    mutationFn: async (input: { bankTransactionId: string; ledgerEntryId: string }) => {
      if (!activeAssociationId) throw new Error("Select an association first");
      const res = await apiRequest("POST", "/api/plaid/reconcile/manual", {
        associationId: activeAssociationId,
        ...input,
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Match applied" });
      qc.invalidateQueries({ queryKey: ["/api/plaid/reconcile/pending", activeAssociationId] });
      qc.invalidateQueries({ queryKey: ["/api/plaid/transactions", activeAssociationId] });
    },
    onError: (err: Error) =>
      toast({ title: "Match failed", description: err.message, variant: "destructive" }),
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

      {pendingRecon && pendingRecon.unmatchedCredits.length > 0 ? (
        <Card data-testid="pending-reconciliation-callout" className="border-warning">
          <CardHeader className="flex flex-row items-start gap-3">
            <AlertTriangle className="mt-1 h-5 w-5 text-warning" aria-hidden />
            <div className="flex-1">
              <CardTitle className="text-base">Pending reconciliation</CardTitle>
              <CardDescription>
                {pendingRecon.unmatchedCredits.length} unmatched bank credit(s) — pair them with pending owner payment intents below, or run auto-reconcile.
              </CardDescription>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => reconcileAuto.mutate()}
              disabled={reconcileAuto.isPending}
              data-testid="btn-auto-reconcile"
            >
              {reconcileAuto.isPending ? "Matching…" : "Auto-reconcile"}
            </Button>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Match to invoice</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingRecon.unmatchedCredits.map((credit) => (
                  <TableRow key={credit.id} data-testid={`unmatched-credit-${credit.id}`}>
                    <TableCell>{formatDate(credit.date)}</TableCell>
                    <TableCell>{credit.merchantName ?? credit.name}</TableCell>
                    <TableCell className="text-right">
                      {formatMoney(Math.abs(credit.amountCents))}
                    </TableCell>
                    <TableCell>
                      {credit.candidates.length === 0 ? (
                        <span className="text-xs text-on-surface-variant">No candidates within ±$1</span>
                      ) : (
                        <Select
                          onValueChange={(ledgerEntryId) =>
                            manualMatch.mutate({
                              bankTransactionId: credit.id,
                              ledgerEntryId,
                            })
                          }
                        >
                          <SelectTrigger
                            className="w-full"
                            data-testid={`select-match-${credit.id}`}
                            disabled={manualMatch.isPending}
                          >
                            <SelectValue placeholder="Choose pending entry…" />
                          </SelectTrigger>
                          <SelectContent>
                            {credit.candidates.map((cand) => (
                              <SelectItem key={cand.id} value={cand.id}>
                                {`$${Math.abs(cand.amount).toFixed(2)} — ${cand.description ?? "(no description)"} — ${formatDate(cand.createdAt)}`}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : null}

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
          <Tabs defaultValue="accounts">
            <TabsList>
              <TabsTrigger value="accounts" data-testid="tab-accounts">Accounts</TabsTrigger>
              <TabsTrigger value="transactions" data-testid="tab-transactions">Transactions</TabsTrigger>
            </TabsList>

            <TabsContent value="accounts" className="mt-4">
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
            </TabsContent>

            <TabsContent value="transactions" className="mt-4">
              {transactions.length === 0 ? (
                <EmptyState
                  icon={Receipt}
                  title="No transactions yet"
                  description="Click Sync Now to pull the latest transactions from your bank."
                />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Reconciled</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transactions.map((txn) => (
                      <TableRow key={txn.id}>
                        <TableCell>{formatDate(txn.date)}</TableCell>
                        <TableCell>{txn.merchantName ?? txn.name}</TableCell>
                        <TableCell className="text-right">{formatMoney(txn.amountCents)}</TableCell>
                        <TableCell>
                          <Badge variant={txn.reconciledToPaymentTransactionId ? "default" : "outline"}>
                            {txn.reconciledToPaymentTransactionId ? "Yes" : "No"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
