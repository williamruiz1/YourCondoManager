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
import { VirtualizedLedgerTable } from "@/components/virtualized-ledger-table";
import { PortalShell, usePortalContext } from "./portal-shell";
import { t } from "@/i18n/use-strings";

// 5.4-F7 (Wave 16b) — when a ledger has more than this many rows, use
// `@tanstack/react-virtual` to keep only the visible window in the DOM.
// Below the threshold we keep the standard `<Table>` markup to avoid
// virtualization overhead on tiny tables.
const LEDGER_VIRTUALIZE_THRESHOLD = 50;

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
  if (path === "/portal/finances/payment-methods") return t("portal.finances.paymentMethods.title");
  if (path === "/portal/finances/ledger") return "Ledger";
  if (path.startsWith("/portal/finances/assessments/")) return t("portal.finances.assessment.title");
  return t("portal.finances.title");
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
      // Wave 26 — `/api/portal/ledger` actually returns
      // `{ entries, balance }` (server/routes.ts L12187), but legacy
      // route-mocks returned a bare array. Coerce to the legacy shape
      // the rest of this component depends on (`.slice` / `.length`).
      const body = (await res.json()) as
        | OwnerLedgerEntry[]
        | { entries?: OwnerLedgerEntry[] };
      if (Array.isArray(body)) return body;
      return body.entries ?? [];
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
          {t("portal.finances.title")}
        </h1>
        <p className="mt-1 text-sm text-on-surface-variant">
          {t("portal.finances.subtitle")}
        </p>
      </div>

      <section className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="py-5">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-on-surface-variant">{t("portal.finances.cards.balanceDue")}</p>
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
            <p className="text-[10px] font-semibold uppercase tracking-widest text-on-surface-variant">{t("portal.finances.cards.totalPaidYtd")}</p>
            <p className="mt-1 font-headline text-3xl">${(dashboard?.totalPayments ?? 0).toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-5">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-on-surface-variant">{t("portal.finances.cards.totalChargesYtd")}</p>
            <p className="mt-1 font-headline text-3xl">${(dashboard?.totalCharges ?? 0).toFixed(2)}</p>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardContent className="space-y-3 py-5">
            <h2 className="font-headline text-lg" id="portal-finances-make-payment-heading">{t("portal.finances.makePayment.title")}</h2>
            <div className="flex gap-2">
              <Input
                type="number"
                min="0"
                step="0.01"
                placeholder={t("portal.finances.makePayment.amountPlaceholder")}
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                data-testid="portal-finances-amount-input"
                aria-labelledby="portal-finances-make-payment-heading"
                aria-label={t("portal.finances.makePayment.amountPlaceholder")}
              />
              <Button
                onClick={() => {
                  const amt = Number(paymentAmount);
                  if (Number.isFinite(amt) && amt > 0) startCheckout.mutate(amt);
                }}
                disabled={startCheckout.isPending || !paymentAmount}
                data-testid="portal-finances-pay-now"
              >
                {startCheckout.isPending ? t("portal.finances.makePayment.redirecting") : t("portal.finances.makePayment.cta")}
              </Button>
            </div>
            <p className="text-xs text-on-surface-variant">
              {t("portal.finances.makePayment.body")}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-3 py-5">
            <h2 className="font-headline text-lg">{t("portal.finances.quickLinks.title")}</h2>
            <div className="grid grid-cols-1 gap-2">
              <Link
                href="/portal/finances/payment-methods"
                className="flex items-center justify-between rounded-lg border border-outline-variant/10 px-4 py-3 text-sm font-semibold hover:bg-surface-container focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                data-testid="portal-finances-link-payment-methods"
              >
                {t("portal.finances.quickLinks.paymentMethods")}
                <span className="material-symbols-outlined text-base" aria-hidden="true">arrow_forward</span>
              </Link>
              <Link
                href="/portal/finances/ledger"
                className="flex items-center justify-between rounded-lg border border-outline-variant/10 px-4 py-3 text-sm font-semibold hover:bg-surface-container focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                data-testid="portal-finances-link-ledger"
              >
                {t("portal.finances.quickLinks.fullLedger")}
                <span className="material-symbols-outlined text-base" aria-hidden="true">arrow_forward</span>
              </Link>
            </div>
          </CardContent>
        </Card>
      </section>

      {upcoming.length > 0 ? (
        <section data-testid="portal-finances-upcoming-assessments" aria-labelledby="portal-finances-upcoming-heading">
          <h2 id="portal-finances-upcoming-heading" className="mb-3 font-headline text-lg">{t("portal.finances.upcoming.title")}</h2>
          <div className="grid gap-3">
            {upcoming.map((item) => (
              <Link
                key={`${item.assessmentId}-${item.installmentNumber}`}
                href={`/portal/finances/assessments/${item.assessmentId}`}
                className="flex items-center justify-between rounded-xl border border-outline-variant/10 bg-surface p-4 hover:border-primary/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                data-testid={`portal-finances-assessment-${item.assessmentId}`}
                aria-label={`${item.assessmentName} — installment ${item.installmentNumber}`}
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

      <section data-testid="portal-finances-recent-ledger" aria-labelledby="portal-finances-recent-heading">
        <div className="mb-3 flex items-center justify-between">
          <h2 id="portal-finances-recent-heading" className="font-headline text-lg">{t("portal.finances.recentLedger.title")}</h2>
          <Link
            href="/portal/finances/ledger"
            className="rounded text-xs font-semibold text-primary hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            {t("portal.finances.recentLedger.viewFull")}
          </Link>
        </div>
        {ledger.length === 0 ? (
          <Card>
            <CardContent className="py-6 text-sm text-on-surface-variant" role="status">{t("portal.finances.recentLedger.empty")}</CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-0">
              <Table aria-labelledby="portal-finances-recent-heading">
                <caption className="sr-only">{t("portal.finances.recentLedger.title")}</caption>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("portal.finances.col.date")}</TableHead>
                    <TableHead>{t("portal.finances.col.type")}</TableHead>
                    <TableHead>{t("portal.finances.col.description")}</TableHead>
                    <TableHead className="text-right">{t("portal.finances.col.amount")}</TableHead>
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
            {t("portal.finances.paymentMethods.title")}
          </h1>
          <p className="mt-1 text-sm text-on-surface-variant">
            {t("portal.finances.paymentMethods.subtitle")}
          </p>
        </div>
        <Button onClick={() => setupMethod.mutate()} disabled={setupMethod.isPending} data-testid="portal-finances-add-method">
          {setupMethod.isPending ? t("portal.finances.paymentMethods.opening") : t("portal.finances.paymentMethods.add")}
        </Button>
      </div>

      <section aria-labelledby="payment-methods-saved-heading">
        <h2 id="payment-methods-saved-heading" className="mb-3 font-headline text-lg">{t("portal.finances.paymentMethods.savedTitle")}</h2>
        {methods.length === 0 ? (
          <Card>
            <CardContent className="py-6 text-sm text-on-surface-variant" role="status">
              {t("portal.finances.paymentMethods.savedEmpty")}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {methods.map((m) => (
              <Card key={m.id}>
                <CardContent className="flex items-center justify-between py-4">
                  <div>
                    <p className="text-sm font-semibold">
                      {m.bankName ?? t("portal.finances.paymentMethods.bankAccount")} ··· {m.last4}
                    </p>
                    {m.accountHolderName ? (
                      <p className="text-xs text-on-surface-variant">{m.accountHolderName}</p>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-2">
                    {m.isDefault ? (
                      <Badge variant="secondary">{t("portal.finances.paymentMethods.default")}</Badge>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setDefault.mutate(m.id)}
                        aria-label={`${t("portal.finances.paymentMethods.setDefault")} — ${m.bankName ?? t("portal.finances.paymentMethods.bankAccount")} ${m.last4}`}
                      >
                        {t("portal.finances.paymentMethods.setDefault")}
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => removeMethod.mutate(m.id)}
                      aria-label={`${t("portal.finances.paymentMethods.remove")} — ${m.bankName ?? t("portal.finances.paymentMethods.bankAccount")} ${m.last4}`}
                    >
                      {t("portal.finances.paymentMethods.remove")}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section aria-labelledby="autopay-heading">
        <h2 id="autopay-heading" className="mb-3 font-headline text-lg">{t("portal.finances.autopay.title")}</h2>
        {enrollments.length === 0 ? (
          <Card>
            <CardContent className="py-6 text-sm text-on-surface-variant" role="status">
              {t("portal.finances.autopay.empty")}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {enrollments.map((e) => (
              <Card key={e.id}>
                <CardContent className="flex items-center justify-between py-4">
                  <div>
                    <p className="text-sm font-semibold capitalize">{e.frequency.replace(/-/g, " ")}</p>
                    <p className="text-xs text-on-surface-variant">{t("portal.finances.autopay.statusLabel")} {e.status}</p>
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
      // Wave 26 — `/api/portal/ledger` actually returns
      // `{ entries, balance }` (server/routes.ts L12187), but legacy
      // route-mocks returned a bare array. Coerce to the legacy shape
      // the rest of this component depends on (`.slice` / `.length`).
      const body = (await res.json()) as
        | OwnerLedgerEntry[]
        | { entries?: OwnerLedgerEntry[] };
      if (Array.isArray(body)) return body;
      return body.entries ?? [];
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
          {t("portal.finances.ledger.title")}
        </h1>
        <p className="mt-1 text-sm text-on-surface-variant">
          {t("portal.finances.ledger.subtitle")}
        </p>
      </div>
      <div
        className="flex flex-wrap gap-2"
        role="group"
        aria-label={t("portal.finances.col.type")}
      >
        {typeOptions.map((opt) => (
          <button
            key={opt}
            type="button"
            onClick={() => setTypeFilter(opt)}
            aria-pressed={typeFilter === opt}
            className={`rounded-full px-3 py-1 text-xs font-semibold uppercase focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${
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
          title={t("portal.finances.ledger.empty.title")}
          description={t("portal.finances.ledger.empty.body")}
          testId="portal-finances-ledger-empty"
        />
      ) : (
        <Card>
          {/* 5.3 — table scrolls horizontally on narrow screens rather
              than bursting the container at 375px.
              5.4-F7 (Wave 16b) — when there are more than 50 filtered
              rows we switch to a virtualized div-grid layout so only
              the visible window is in the DOM. ≤50 rows continues to
              use the standard `<Table>` markup unchanged. */}
          <CardContent className="p-0 overflow-x-auto">
            {filtered.length > LEDGER_VIRTUALIZE_THRESHOLD ? (
              <VirtualizedPortalLedger entries={filtered} />
            ) : (
              <Table aria-label={t("portal.finances.ledger.title")}>
                <caption className="sr-only">{t("portal.finances.ledger.title")}</caption>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("portal.finances.col.date")}</TableHead>
                    <TableHead>{t("portal.finances.col.type")}</TableHead>
                    <TableHead>{t("portal.finances.col.description")}</TableHead>
                    <TableHead className="text-right">{t("portal.finances.col.amount")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="py-6 text-center text-sm text-on-surface-variant">
                        {t("portal.finances.ledger.empty.filterMatch")}
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
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ---------- 5.4-F7: Virtualized portal ledger ---------------------------
//
// When `filtered.length > LEDGER_VIRTUALIZE_THRESHOLD`, the LedgerContent
// component swaps to this div-grid layout so only the rows in view are
// kept in the DOM. The visual columns mirror the legacy `<Table>` exactly:
// Date / Type / Description / right-aligned Amount.

function VirtualizedPortalLedger({ entries }: { entries: OwnerLedgerEntry[] }) {
  const gridTemplate = "minmax(90px, 110px) minmax(90px, 130px) minmax(150px, 1fr) minmax(80px, 110px)";
  return (
    <div data-testid="portal-finances-ledger-virtualized" role="table" aria-label={t("portal.finances.ledger.title")}>
      <div
        className="grid border-b text-xs font-medium uppercase tracking-wide text-on-surface-variant"
        style={{ gridTemplateColumns: gridTemplate }}
        role="row"
      >
        <div className="px-4 py-3" role="columnheader">{t("portal.finances.col.date")}</div>
        <div className="px-4 py-3" role="columnheader">{t("portal.finances.col.type")}</div>
        <div className="px-4 py-3" role="columnheader">{t("portal.finances.col.description")}</div>
        <div className="px-4 py-3 text-right" role="columnheader">{t("portal.finances.col.amount")}</div>
      </div>
      <VirtualizedLedgerTable<OwnerLedgerEntry>
        rows={entries}
        threshold={LEDGER_VIRTUALIZE_THRESHOLD}
        estimateRowHeight={44}
        containerHeight={520}
        getRowKey={(entry) => entry.id}
        renderRow={(entry) => (
          <div
            className="grid border-b text-xs transition-colors hover:bg-muted/40"
            style={{ gridTemplateColumns: gridTemplate }}
            data-testid={`ledger-row-${entry.id}`}
            role="row"
          >
            <div className="px-4 py-3">
              {entry.postedAt ? new Date(entry.postedAt).toLocaleDateString() : "—"}
            </div>
            <div className="px-4 py-3">
              <Badge variant="outline">{entry.entryType.replace(/-/g, " ")}</Badge>
            </div>
            <div className="truncate px-4 py-3" title={entry.description ?? undefined}>
              {entry.description ?? "—"}
            </div>
            <div className="px-4 py-3 text-right">${Number(entry.amount).toFixed(2)}</div>
          </div>
        )}
      />
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
        <Link
          href="/portal/finances"
          className="rounded text-xs font-semibold text-primary hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          {t("portal.finances.assessment.backLink")}
        </Link>
      </div>
      <h1 className="font-headline text-3xl" data-testid="portal-finances-assessment-detail-heading">
        {t("portal.finances.assessment.title")}
      </h1>
      <p className="text-sm text-on-surface-variant">
        {t("portal.finances.assessment.body")}
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
