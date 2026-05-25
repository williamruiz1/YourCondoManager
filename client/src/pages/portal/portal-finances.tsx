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

import { useCallback, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Receipt } from "lucide-react";
import { usePlaidLink } from "react-plaid-link";
import type { PlaidLinkOnSuccess, PlaidLinkOnSuccessMetadata } from "react-plaid-link";
import type { OwnerLedgerEntry } from "@shared/schema";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/empty-state";
import { PortalAssessmentDetailDialog } from "@/components/portal-assessment-detail-dialog";
import { VirtualizedLedgerTable } from "@/components/virtualized-ledger-table";
import { PortalShell, usePortalContext } from "./portal-shell";
import { t } from "@/i18n/use-strings";

// 2026-05-25 — Per-unit hierarchical finances breakdown (William ratification
// 2026-05-25). Owners with multiple units were seeing three line items all
// labeled "assessment" with no unit attribution. The server now returns
// `byUnit` on /api/portal/financial-dashboard; the hub renders a collapsible
// card per unit with category split and entry detail.

type FinanceCategoryKey = "charge" | "assessment" | "payment" | "late-fee" | "credit" | "adjustment";

// 2026-05-25 — per coordinator correction: do not surface "late fees" yet.
// All other categories stay visible (incl. $0) so the owner can see that
// nothing is hidden. Late-fee data still flows through the server response;
// it's just not rendered in the per-unit category split until enabled.
const FINANCE_CATEGORY_ORDER: FinanceCategoryKey[] = [
  "assessment",
  "charge",
  "payment",
  "credit",
  "adjustment",
];

const FINANCE_CATEGORY_LABEL: Record<FinanceCategoryKey, string> = {
  assessment: "Assessment",
  charge: "HOA dues",
  "late-fee": "Late fee",
  payment: "Payment",
  credit: "Credit",
  adjustment: "Adjustment",
};

// Stacked-bar segment colors — restrained palette per the wireframe.
// Teal accent for the active "assessment" category; cooler tones for
// regular charges; on-surface-variant for inactive categories.
const FINANCE_CATEGORY_BAR_COLOR: Record<FinanceCategoryKey, string> = {
  assessment: "bg-primary",
  charge: "bg-primary/60",
  "late-fee": "bg-destructive/70",
  payment: "bg-emerald-500/70",
  credit: "bg-emerald-400/60",
  adjustment: "bg-on-surface-variant/40",
};

type FinanceUnitEntry = {
  id: string;
  entryType: FinanceCategoryKey | string;
  amount: number;
  postedAt: string | Date | null;
  description: string | null;
};

type FinanceUnitBreakdown = {
  unitId: string;
  unitLabel: string;
  unitNumber: string | null;
  building: string | null;
  total: number;
  byCategory: Partial<Record<FinanceCategoryKey, number>>;
  entries: FinanceUnitEntry[];
};

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
  // 2026-05-25 — additive, server-side per-unit grouping.
  byUnit?: FinanceUnitBreakdown[];
  grandTotal?: number;
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

// ---------- Plaid bank-payment card (Issue #333) ----------
//
// Owner-side Plaid flow. If no portal-scoped bank connection exists, the
// card surfaces a "Connect your bank" CTA that drives the Plaid Link sheet
// via /api/portal/plaid/create-link-token. Once connected, the card lets
// the owner pay against their outstanding balance via /api/portal/plaid/pay
// — payment is recorded as a pending ledger entry; ACH execution is a
// follow-up job.

type PortalBankConnection = {
  id: string;
  institutionName: string | null;
  status: string;
  createdAt: string | Date;
};

function PortalBankPaymentCard({ balance }: { balance: number }) {
  const { portalFetch } = usePortalContext();
  const qc = useQueryClient();
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [confirmAmount, setConfirmAmount] = useState<string>("");
  const [confirming, setConfirming] = useState(false);
  const [submitMessage, setSubmitMessage] = useState<string | null>(null);

  const { data: connection } = useQuery<PortalBankConnection | null>({
    queryKey: ["portal/plaid/connection"],
    queryFn: async () => {
      const res = await portalFetch("/api/portal/plaid/connection");
      if (!res.ok) return null;
      return (await res.json()) as PortalBankConnection | null;
    },
  });

  const createLinkToken = useMutation({
    mutationFn: async () => {
      const res = await portalFetch("/api/portal/plaid/create-link-token", { method: "POST" });
      if (!res.ok) throw new Error(await res.text());
      return res.json() as Promise<{ linkToken: string }>;
    },
    onSuccess: (data) => setLinkToken(data.linkToken),
  });

  const exchangeToken = useMutation({
    mutationFn: async (input: { publicToken: string; institutionName: string | null }) => {
      const res = await portalFetch("/api/portal/plaid/exchange-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      setLinkToken(null);
      qc.invalidateQueries({ queryKey: ["portal/plaid/connection"] });
    },
  });

  const submitPayment = useMutation({
    mutationFn: async (amount: number) => {
      const res = await portalFetch("/api/portal/plaid/pay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount, description: "HOA dues — bank payment" }),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json() as Promise<{ status: string; message: string }>;
    },
    onSuccess: (data) => {
      setSubmitMessage(data.message ?? "Payment submitted — processing in 1-3 business days.");
      setConfirming(false);
      setConfirmAmount("");
      qc.invalidateQueries({ queryKey: ["portal/financial-dashboard"] });
      qc.invalidateQueries({ queryKey: ["portal/ledger"] });
    },
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

  const { open: openPlaid, ready: plaidReady } = usePlaidLink({
    token: linkToken,
    onSuccess: onPlaidSuccess,
    onExit: () => setLinkToken(null),
  });

  if (linkToken && plaidReady) {
    setTimeout(() => openPlaid(), 0);
  }

  const handlePayClick = () => {
    setSubmitMessage(null);
    setConfirmAmount(balance > 0 ? balance.toFixed(2) : "");
    setConfirming(true);
  };

  return (
    <Card data-testid="portal-bank-payment">
      <CardContent className="space-y-3 py-5">
        <h2 className="font-headline text-lg">Pay with Bank Account</h2>
        {submitMessage ? (
          <p className="text-sm text-on-surface" data-testid="portal-bank-payment-success">{submitMessage}</p>
        ) : null}

        {!connection ? (
          <>
            <p className="text-sm text-on-surface-variant">
              Link your checking or savings account via Plaid to pay assessments directly from your bank — no card fees.
            </p>
            <Button
              onClick={() => createLinkToken.mutate()}
              disabled={createLinkToken.isPending}
              data-testid="portal-bank-connect"
            >
              {createLinkToken.isPending ? "Opening…" : "Connect your bank"}
            </Button>
          </>
        ) : !confirming ? (
          <>
            <p className="text-sm text-on-surface-variant" data-testid="portal-bank-connected">
              Connected: <strong>{connection.institutionName ?? "Bank"}</strong>
            </p>
            <Button
              onClick={handlePayClick}
              disabled={balance <= 0}
              data-testid="portal-bank-pay-now"
            >
              {balance > 0 ? `Pay $${balance.toFixed(2)} from bank` : "No balance due"}
            </Button>
          </>
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-on-surface-variant">Confirm amount to pay</p>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={confirmAmount}
              onChange={(e) => setConfirmAmount(e.target.value)}
              data-testid="portal-bank-confirm-amount"
            />
            <div className="flex gap-2">
              <Button
                onClick={() => {
                  const amt = Number(confirmAmount);
                  if (Number.isFinite(amt) && amt > 0) submitPayment.mutate(amt);
                }}
                disabled={submitPayment.isPending || !confirmAmount}
                data-testid="portal-bank-confirm"
              >
                {submitPayment.isPending ? "Submitting…" : "Confirm Payment"}
              </Button>
              <Button variant="outline" onClick={() => setConfirming(false)}>
                Cancel
              </Button>
            </div>
            <p className="text-xs text-on-surface-variant">
              Payment is recorded immediately. ACH transfer settles in 1–3 business days.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ---------- Per-unit hierarchical breakdown (2026-05-25) ----------

function formatCurrency(amount: number): string {
  const abs = Math.abs(amount);
  return abs.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Stacked horizontal bar showing how a unit's balance breaks down across
 * categories. Renders even when only one category is present so the visual
 * vocabulary stays consistent. Uses `aria-label` for screen-reader summary;
 * the legend below the bar carries the keyed amounts.
 */
function CategoryStackedBar({
  byCategory,
  total,
}: {
  byCategory: Partial<Record<FinanceCategoryKey, number>>;
  total: number;
}) {
  const totalForBar = FINANCE_CATEGORY_ORDER.reduce(
    (sum, cat) => sum + Math.max(0, byCategory[cat] ?? 0),
    0,
  );
  if (totalForBar <= 0) {
    return (
      <div
        className="h-2 w-full rounded-full bg-surface-container"
        aria-label="No outstanding categories"
        data-testid="unit-category-bar-empty"
      />
    );
  }
  return (
    <div
      className="flex h-2 w-full overflow-hidden rounded-full bg-surface-container"
      role="img"
      aria-label={`Category split for ${formatCurrency(total)}`}
      data-testid="unit-category-bar"
    >
      {FINANCE_CATEGORY_ORDER.map((cat) => {
        const value = Math.max(0, byCategory[cat] ?? 0);
        if (value <= 0) return null;
        const pct = (value / totalForBar) * 100;
        return (
          <div
            key={cat}
            className={`${FINANCE_CATEGORY_BAR_COLOR[cat]} h-full`}
            style={{ width: `${pct}%` }}
            aria-label={`${FINANCE_CATEGORY_LABEL[cat]} ${formatCurrency(value)}`}
          />
        );
      })}
    </div>
  );
}

/**
 * Per-unit collapsible card. Header always shows: unit label + total due.
 * Expanded body shows the category breakdown (rendered for ALL categories,
 * even those at $0 — per William's "where is HOA dues" question, make
 * absence visible) plus the ledger entries scoped to this unit.
 */
function PerUnitFinanceCard({ unit }: { unit: FinanceUnitBreakdown }) {
  const headerTotal = unit.total;
  return (
    <AccordionItem
      value={unit.unitId}
      className="overflow-hidden rounded-2xl border border-outline-variant/15 bg-surface !border-b"
      data-testid={`portal-finances-unit-${unit.unitId}`}
    >
      <AccordionTrigger
        className="px-5 py-4 hover:no-underline"
        data-testid={`portal-finances-unit-${unit.unitId}-trigger`}
      >
        <div className="flex flex-1 items-center justify-between gap-4">
          <div className="text-left">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-on-surface-variant">
              Unit
            </p>
            <p className="font-headline text-xl text-on-surface" data-testid={`portal-finances-unit-${unit.unitId}-label`}>
              {unit.unitLabel}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-on-surface-variant">
              {headerTotal > 0 ? "Balance due" : "Balance"}
            </p>
            <p
              className={`font-headline text-2xl ${headerTotal > 0 ? "text-destructive" : "text-on-surface"}`}
              data-testid={`portal-finances-unit-${unit.unitId}-total`}
            >
              ${formatCurrency(headerTotal)}
            </p>
          </div>
        </div>
      </AccordionTrigger>
      <AccordionContent className="px-5">
        {/* Category split (stacked bar + legend) */}
        <div className="space-y-3 border-t border-outline-variant/10 pt-4">
          <CategoryStackedBar byCategory={unit.byCategory} total={headerTotal} />
          <ul
            className="grid grid-cols-1 gap-x-6 gap-y-1 sm:grid-cols-2"
            data-testid={`portal-finances-unit-${unit.unitId}-categories`}
          >
            {FINANCE_CATEGORY_ORDER.map((cat) => {
              const value = unit.byCategory[cat] ?? 0;
              return (
                <li
                  key={cat}
                  className="flex items-center justify-between gap-3 text-sm"
                  data-testid={`portal-finances-unit-${unit.unitId}-category-${cat}`}
                >
                  <span className="flex items-center gap-2">
                    <span
                      aria-hidden="true"
                      className={`inline-block h-2 w-2 rounded-full ${FINANCE_CATEGORY_BAR_COLOR[cat]} ${
                        value <= 0 ? "opacity-30" : ""
                      }`}
                    />
                    <span className={value > 0 ? "text-on-surface" : "text-on-surface-variant"}>
                      {FINANCE_CATEGORY_LABEL[cat]}
                    </span>
                  </span>
                  <span
                    className={`font-medium tabular-nums ${value > 0 ? "text-on-surface" : "text-on-surface-variant"}`}
                  >
                    ${formatCurrency(value)}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Entry detail — the rows that produce the per-category totals. */}
        {unit.entries.length > 0 ? (
          <div className="mt-5">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-on-surface-variant">
              Recent entries
            </p>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-24">Date</TableHead>
                  <TableHead className="w-28">Type</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="w-28 text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {unit.entries.slice(0, 8).map((entry) => (
                  <TableRow key={entry.id} data-testid={`portal-finances-unit-${unit.unitId}-entry-${entry.id}`}>
                    <TableCell className="text-xs text-on-surface-variant">
                      {entry.postedAt ? new Date(entry.postedAt).toLocaleDateString() : "—"}
                    </TableCell>
                    <TableCell className="text-xs">
                      <Badge variant="outline" className="capitalize">
                        {String(entry.entryType).replace(/-/g, " ")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">{entry.description ?? "—"}</TableCell>
                    <TableCell className="text-right text-xs tabular-nums">
                      ${formatCurrency(Number(entry.amount))}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <p
            className="mt-5 text-xs text-on-surface-variant"
            data-testid={`portal-finances-unit-${unit.unitId}-no-entries`}
          >
            No ledger entries for this unit.
          </p>
        )}
      </AccordionContent>
    </AccordionItem>
  );
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
  const byUnit = dashboard?.byUnit ?? [];
  // Default-expand the first unit (or all units if there are <= 3) so the
  // owner sees the breakdown without having to click. Per the wireframe.
  const defaultOpenUnits = useMemo(
    () => (byUnit.length <= 3 ? byUnit.map((u) => u.unitId) : byUnit.slice(0, 1).map((u) => u.unitId)),
    [byUnit],
  );

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
        {/* Cream balance hero per the wireframe — anchors the page so the
            owner sees Total balance + unit count without scrolling. */}
        <Card
          className="border-primary/15 bg-primary/[0.06] md:col-span-1"
          data-testid="portal-finances-balance-hero"
        >
          <CardContent className="py-5">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-primary">
              {byUnit.length > 1 ? "Total balance" : t("portal.finances.cards.balanceDue")}
            </p>
            {/* Wave 25 — `text-secondary` resolves to a near-white tone in
                light mode and fails WCAG AA color contrast (axe). Use the
                standard on-surface foreground when there is no balance
                due; the destructive tone stays for non-zero balance. */}
            <p
              className={`mt-1 font-headline text-4xl md:text-5xl tabular-nums ${
                balance > 0 ? "text-destructive" : "text-on-surface"
              }`}
              data-testid="portal-finances-balance"
            >
              ${formatCurrency(balance)}
            </p>
            <p className="mt-2 text-xs text-on-surface-variant">
              {byUnit.length > 0
                ? `Across ${byUnit.length} ${byUnit.length === 1 ? "unit" : "units"}`
                : null}
              {dashboard?.nextDueDate ? (
                <>
                  {byUnit.length > 0 ? " · " : null}
                  Next due {new Date(dashboard.nextDueDate).toLocaleDateString()}
                </>
              ) : null}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-5">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-on-surface-variant">{t("portal.finances.cards.totalPaidYtd")}</p>
            <p className="mt-1 font-headline text-3xl tabular-nums">${formatCurrency(dashboard?.totalPayments ?? 0)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-5">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-on-surface-variant">{t("portal.finances.cards.totalChargesYtd")}</p>
            <p className="mt-1 font-headline text-3xl tabular-nums">${formatCurrency(dashboard?.totalCharges ?? 0)}</p>
          </CardContent>
        </Card>
      </section>

      <PortalBankPaymentCard balance={balance} />

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

      {byUnit.length > 0 ? (
        <section
          data-testid="portal-finances-by-unit"
          aria-labelledby="portal-finances-by-unit-heading"
        >
          <div className="mb-3 flex items-end justify-between gap-4">
            <div>
              <h2 id="portal-finances-by-unit-heading" className="font-headline text-lg">
                By unit
              </h2>
              <p className="text-xs text-on-surface-variant">
                {byUnit.length === 1
                  ? "Breakdown for your unit."
                  : `Breakdown across your ${byUnit.length} units.`}
              </p>
            </div>
            <p
              className="font-headline text-xl text-on-surface tabular-nums"
              data-testid="portal-finances-by-unit-grand-total"
            >
              ${formatCurrency(dashboard?.grandTotal ?? balance)}
            </p>
          </div>
          <Accordion
            type="multiple"
            defaultValue={defaultOpenUnits}
            className="flex flex-col gap-3"
            data-testid="portal-finances-by-unit-accordion"
          >
            {byUnit.map((unit) => (
              <PerUnitFinanceCard key={unit.unitId} unit={unit} />
            ))}
          </Accordion>
        </section>
      ) : null}

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
