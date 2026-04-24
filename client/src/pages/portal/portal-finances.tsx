// zone: My Finances
// persona: Owner
//
// 3.5 — PortalFinances hub (/portal/finances) replaces the `financials` tab
// of the owner-portal.tsx mega-file. Hub URL per 1.2 Q4; first-person
// label "My Finances" per 1.1 Q5; title "My Finances — YCM" per 1.4 Q7.
//
// Sub-routes per Q1 sub-page mirroring:
//   /portal/finances/payment-methods
//   /portal/finances/ledger
//   /portal/finances/assessments/:assessmentId (leverages 4.3 Q5 drill-in)

import { useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Receipt } from "lucide-react";
import type { OwnerLedgerEntry } from "@shared/schema";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/empty-state";
import { PortalAssessmentDetailDialog } from "@/components/portal-assessment-detail-dialog";
import { PortalShell, usePortalContext } from "./portal-shell";

type FinancialDashboard = {
  balance: number;
  nextDueDate?: string;
  lastPaymentDate?: string;
  totalCharges: number;
  totalPayments: number;
  specialAssessmentUpcomingInstallments?: Array<{
    assessmentId: string;
    assessmentName: string;
    installmentNumber: number;
    installmentAmount: number;
    dueDate: string;
    remainingInstallments: number;
    allocationMethod: string;
    allocationReason: string;
  }>;
};

type PaymentMethod = {
  id: string;
  last4: string;
  bankName?: string | null;
  isDefault: boolean;
  accountHolderName?: string | null;
};

type AutopayEnrollment = {
  id: string;
  status: string;
  amount: number | null;
  frequency: string;
  paymentMethodId: string | null;
};

function getTitleForPath(path: string): string {
  if (path === "/portal/finances/payment-methods") return "Payment methods";
  if (path === "/portal/finances/ledger") return "Ledger";
  if (path.startsWith("/portal/finances/assessments/")) return "Assessment detail";
  return "My Finances";
}

// ---------- Hub surface (/portal/finances) ----------

function FinancesHubContent() {
  const { portalFetch, session } = usePortalContext();
  const qc = useQueryClient();
  const [paymentAmount, setPaymentAmount] = useState("");

  const { data: dashboard } = useQuery<FinancialDashboard>({
    queryKey: ["portal/financial-dashboard", session.id],
    queryFn: async () => {
      const res = await portalFetch("/api/portal/financial-dashboard");
      if (!res.ok) throw new Error("Failed to load dashboard");
      return res.json();
    },
  });

  const { data: ledger = [] } = useQuery<OwnerLedgerEntry[]>({
    queryKey: ["portal/ledger", session.id],
    queryFn: async () => {
      const res = await portalFetch("/api/portal/ledger");
      if (!res.ok) return [];
      return res.json();
    },
  });

  const startCheckout = useMutation({
    mutationFn: async (amount: number) => {
      const res = await portalFetch("/api/portal/pay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount, description: "HOA dues payment" }),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json() as Promise<{ url?: string }>;
    },
    onSuccess: (data) => {
      if (data.url) window.location.assign(data.url);
      qc.invalidateQueries({ queryKey: ["portal/financial-dashboard"] });
    },
  });

  const balance = dashboard?.balance ?? 0;
  const upcoming = dashboard?.specialAssessmentUpcomingInstallments ?? [];

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6" data-testid="portal-finances">
      <div>
        <h1 className="font-headline text-3xl md:text-4xl" data-testid="portal-finances-heading">
          My Finances
        </h1>
        <p className="mt-1 text-sm text-on-surface-variant">
          Pay dues, manage payment methods, and review your ledger history.
        </p>
      </div>

      <section className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="py-5">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-on-surface-variant">Balance due</p>
            <p className={`mt-1 font-headline text-3xl ${balance > 0 ? "text-destructive" : "text-secondary"}`} data-testid="portal-finances-balance">
              ${Math.abs(balance).toFixed(2)}
            </p>
            {dashboard?.nextDueDate ? (
              <p className="mt-1 text-xs text-on-surface-variant">
                Next due {new Date(dashboard.nextDueDate).toLocaleDateString()}
              </p>
            ) : null}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-5">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-on-surface-variant">Total paid (YTD)</p>
            <p className="mt-1 font-headline text-3xl">${(dashboard?.totalPayments ?? 0).toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-5">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-on-surface-variant">Total charges (YTD)</p>
            <p className="mt-1 font-headline text-3xl">${(dashboard?.totalCharges ?? 0).toFixed(2)}</p>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardContent className="space-y-3 py-5">
            <h2 className="font-headline text-lg">Make a payment</h2>
            <div className="flex gap-2">
              <Input
                type="number"
                min="0"
                step="0.01"
                placeholder="Amount"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                data-testid="portal-finances-amount-input"
              />
              <Button
                onClick={() => {
                  const amt = Number(paymentAmount);
                  if (Number.isFinite(amt) && amt > 0) startCheckout.mutate(amt);
                }}
                disabled={startCheckout.isPending || !paymentAmount}
                data-testid="portal-finances-pay-now"
              >
                {startCheckout.isPending ? "Redirecting…" : "Pay now"}
              </Button>
            </div>
            <p className="text-xs text-on-surface-variant">
              Secure checkout via Stripe. You'll be redirected to complete the payment.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-3 py-5">
            <h2 className="font-headline text-lg">Quick links</h2>
            <div className="grid grid-cols-1 gap-2">
              <Link
                href="/portal/finances/payment-methods"
                className="flex items-center justify-between rounded-lg border border-outline-variant/10 px-4 py-3 text-sm font-semibold hover:bg-surface-container"
                data-testid="portal-finances-link-payment-methods"
              >
                Payment methods & autopay
                <span className="material-symbols-outlined text-base">arrow_forward</span>
              </Link>
              <Link
                href="/portal/finances/ledger"
                className="flex items-center justify-between rounded-lg border border-outline-variant/10 px-4 py-3 text-sm font-semibold hover:bg-surface-container"
                data-testid="portal-finances-link-ledger"
              >
                Full ledger history
                <span className="material-symbols-outlined text-base">arrow_forward</span>
              </Link>
            </div>
          </CardContent>
        </Card>
      </section>

      {upcoming.length > 0 ? (
        <section data-testid="portal-finances-upcoming-assessments">
          <h2 className="mb-3 font-headline text-lg">Upcoming special assessments</h2>
          <div className="grid gap-3">
            {upcoming.map((item) => (
              <Link
                key={`${item.assessmentId}-${item.installmentNumber}`}
                href={`/portal/finances/assessments/${item.assessmentId}`}
                className="flex items-center justify-between rounded-xl border border-outline-variant/10 bg-surface p-4 hover:border-primary/30"
                data-testid={`portal-finances-assessment-${item.assessmentId}`}
              >
                <div>
                  <p className="font-semibold">{item.assessmentName}</p>
                  <p className="text-xs text-on-surface-variant">
                    Installment {item.installmentNumber} · due {new Date(item.dueDate).toLocaleDateString()} ·{" "}
                    {item.remainingInstallments} remaining
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-semibold">${item.installmentAmount.toFixed(2)}</p>
                  <p className="text-[10px] uppercase text-on-surface-variant">Details →</p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <section data-testid="portal-finances-recent-ledger">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-headline text-lg">Recent ledger</h2>
          <Link href="/portal/finances/ledger" className="text-xs font-semibold text-primary hover:underline">
            View full ledger
          </Link>
        </div>
        {ledger.length === 0 ? (
          <Card>
            <CardContent className="py-6 text-sm text-on-surface-variant">No ledger entries yet.</CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ledger.slice(0, 8).map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell className="text-xs">
                        {entry.postedAt ? new Date(entry.postedAt).toLocaleDateString() : "—"}
                      </TableCell>
                      <TableCell className="capitalize text-xs">
                        <Badge variant="outline">{entry.entryType.replace(/-/g, " ")}</Badge>
                      </TableCell>
                      <TableCell className="text-xs">{entry.description ?? "—"}</TableCell>
                      <TableCell className="text-right text-xs">${Number(entry.amount).toFixed(2)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </section>
    </div>
  );
}

// ---------- Sub-page: payment methods ----------

function PaymentMethodsContent() {
  const { portalFetch, session } = usePortalContext();
  const qc = useQueryClient();

  const { data: methods = [] } = useQuery<PaymentMethod[]>({
    queryKey: ["portal/payment-methods", session.id],
    queryFn: async () => {
      const res = await portalFetch("/api/portal/payment-methods");
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: enrollments = [] } = useQuery<AutopayEnrollment[]>({
    queryKey: ["portal/autopay/enrollments", session.id],
    queryFn: async () => {
      const res = await portalFetch("/api/portal/autopay/enrollments");
      if (!res.ok) return [];
      return res.json();
    },
  });

  const setupMethod = useMutation({
    mutationFn: async () => {
      const res = await portalFetch("/api/portal/payment-methods/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json() as Promise<{ url?: string }>;
    },
    onSuccess: (data) => {
      if (data.url) window.location.assign(data.url);
    },
  });

  const removeMethod = useMutation({
    mutationFn: async (id: string) => {
      const res = await portalFetch(`/api/portal/payment-methods/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["portal/payment-methods"] }),
  });

  const setDefault = useMutation({
    mutationFn: async (id: string) => {
      const res = await portalFetch(`/api/portal/payment-methods/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isDefault: true }),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["portal/payment-methods"] }),
  });

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6" data-testid="portal-finances-payment-methods">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-headline text-3xl" data-testid="portal-finances-payment-methods-heading">
            Payment methods
          </h1>
          <p className="mt-1 text-sm text-on-surface-variant">
            Bank accounts linked to your portal and autopay enrollments.
          </p>
        </div>
        <Button onClick={() => setupMethod.mutate()} disabled={setupMethod.isPending} data-testid="portal-finances-add-method">
          {setupMethod.isPending ? "Opening…" : "Add method"}
        </Button>
      </div>

      <section>
        <h2 className="mb-3 font-headline text-lg">Saved methods</h2>
        {methods.length === 0 ? (
          <Card>
            <CardContent className="py-6 text-sm text-on-surface-variant">
              No saved payment methods yet. Add a bank account to enable faster checkout and autopay.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {methods.map((m) => (
              <Card key={m.id}>
                <CardContent className="flex items-center justify-between py-4">
                  <div>
                    <p className="text-sm font-semibold">
                      {m.bankName ?? "Bank account"} ··· {m.last4}
                    </p>
                    {m.accountHolderName ? (
                      <p className="text-xs text-on-surface-variant">{m.accountHolderName}</p>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-2">
                    {m.isDefault ? (
                      <Badge variant="secondary">Default</Badge>
                    ) : (
                      <Button size="sm" variant="outline" onClick={() => setDefault.mutate(m.id)}>
                        Set default
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => removeMethod.mutate(m.id)}>
                      Remove
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 font-headline text-lg">Autopay enrollments</h2>
        {enrollments.length === 0 ? (
          <Card>
            <CardContent className="py-6 text-sm text-on-surface-variant">
              You are not currently enrolled in autopay. Enroll from the finances hub to automate monthly dues.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {enrollments.map((e) => (
              <Card key={e.id}>
                <CardContent className="flex items-center justify-between py-4">
                  <div>
                    <p className="text-sm font-semibold capitalize">{e.frequency.replace(/-/g, " ")}</p>
                    <p className="text-xs text-on-surface-variant">Status: {e.status}</p>
                  </div>
                  <Badge variant={e.status === "active" ? "default" : "outline"}>{e.status}</Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

// ---------- Sub-page: full ledger ----------

function LedgerContent() {
  const { portalFetch, session } = usePortalContext();
  const [typeFilter, setTypeFilter] = useState<string>("all");

  const { data: ledger = [] } = useQuery<OwnerLedgerEntry[]>({
    queryKey: ["portal/ledger", session.id],
    queryFn: async () => {
      const res = await portalFetch("/api/portal/ledger");
      if (!res.ok) return [];
      return res.json();
    },
  });

  const filtered = useMemo(
    () => (typeFilter === "all" ? ledger : ledger.filter((l) => l.entryType === typeFilter)),
    [ledger, typeFilter],
  );

  const typeOptions = ["all", "charge", "assessment", "payment", "late-fee", "credit", "adjustment"];

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6" data-testid="portal-finances-ledger">
      <div>
        <h1 className="font-headline text-3xl" data-testid="portal-finances-ledger-heading">
          Ledger history
        </h1>
        <p className="mt-1 text-sm text-on-surface-variant">
          All charges, assessments, payments, late fees, and adjustments.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {typeOptions.map((opt) => (
          <button
            key={opt}
            type="button"
            onClick={() => setTypeFilter(opt)}
            className={`rounded-full px-3 py-1 text-xs font-semibold uppercase ${
              typeFilter === opt ? "bg-primary text-on-primary" : "bg-surface-container text-on-surface-variant"
            }`}
            data-testid={`portal-finances-ledger-filter-${opt}`}
          >
            {opt.replace(/-/g, " ")}
          </button>
        ))}
      </div>
      {ledger.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title="No transactions yet"
          description="Charges, assessments, payments, and adjustments will appear here once your account has activity."
          testId="portal-finances-ledger-empty"
        />
      ) : (
        <Card>
          {/* 5.3 — table scrolls horizontally on narrow screens rather
              than bursting the container at 375px. */}
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="py-6 text-center text-sm text-on-surface-variant">
                      No ledger entries match this filter.
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((entry) => (
                    <TableRow key={entry.id} data-testid={`ledger-row-${entry.id}`}>
                      <TableCell className="text-xs">
                        {entry.postedAt ? new Date(entry.postedAt).toLocaleDateString() : "—"}
                      </TableCell>
                      <TableCell className="text-xs">
                        <Badge variant="outline">{entry.entryType.replace(/-/g, " ")}</Badge>
                      </TableCell>
                      <TableCell className="text-xs">{entry.description ?? "—"}</TableCell>
                      <TableCell className="text-right text-xs">${Number(entry.amount).toFixed(2)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ---------- Sub-page: assessment detail ----------

function AssessmentDetailContent({ assessmentId }: { assessmentId: string }) {
  const { portalFetch } = usePortalContext();
  const [, navigate] = useLocation();

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4" data-testid="portal-finances-assessment-detail">
      <div>
        <Link href="/portal/finances" className="text-xs font-semibold text-primary hover:underline">
          ← Back to My Finances
        </Link>
      </div>
      <h1 className="font-headline text-3xl" data-testid="portal-finances-assessment-detail-heading">
        Assessment detail
      </h1>
      <p className="text-sm text-on-surface-variant">
        Leveraging the 4.3 Q5 drill-in surface for the selected special assessment.
      </p>
      <PortalAssessmentDetailDialog
        portalFetch={portalFetch}
        assessmentId={assessmentId}
        open
        onOpenChange={(open) => {
          if (!open) navigate("/portal/finances");
        }}
      />
    </div>
  );
}

// ---------- Router entry point ----------

export default function PortalFinancesPage({
  subPath,
  assessmentId,
}: {
  subPath?: "hub" | "payment-methods" | "ledger" | "assessment";
  assessmentId?: string;
} = {}) {
  const [location] = useLocation();
  const resolvedPath = location;
  const title = getTitleForPath(resolvedPath);
  useDocumentTitle(title);

  let body: JSX.Element;
  if (subPath === "payment-methods") {
    body = <PaymentMethodsContent />;
  } else if (subPath === "ledger") {
    body = <LedgerContent />;
  } else if (subPath === "assessment" && assessmentId) {
    body = <AssessmentDetailContent assessmentId={assessmentId} />;
  } else {
    body = <FinancesHubContent />;
  }

  return <PortalShell>{body}</PortalShell>;
}

export { FinancesHubContent, PaymentMethodsContent, LedgerContent, AssessmentDetailContent };
