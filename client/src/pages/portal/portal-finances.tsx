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
import { CheckCircle2, Receipt } from "lucide-react";
import type { OwnerLedgerEntry } from "@shared/schema";
import type { PerUnitBreakdown } from "@shared/portal-per-unit";
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
import {
  AccountStatementView,
  type AccountStatementResponse,
} from "@/components/account-statement-view";
import {
  PaymentReceiptView,
  type PaymentReceiptData,
} from "@/components/payment-receipt-view";
import { PortalShell, usePortalContext } from "./portal-shell";
import { t } from "@/i18n/use-strings";

// Default statement period helpers — last full calendar month.
function defaultStatementPeriod(): { from: string; to: string } {
  const now = new Date();
  const firstOfThisMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const lastMonthEnd = new Date(firstOfThisMonth.getTime() - 24 * 60 * 60 * 1000);
  const lastMonthStart = new Date(
    Date.UTC(lastMonthEnd.getUTCFullYear(), lastMonthEnd.getUTCMonth(), 1),
  );
  return {
    from: lastMonthStart.toISOString().slice(0, 10),
    to: lastMonthEnd.toISOString().slice(0, 10),
  };
}

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

// 2026-06-30 — human-readable ledger TYPE labels (William finding #5). The
// owner ledger stored raw `entryType` strings ("charge", "assessment") that
// read as jargon. Map each to a plain owner-facing label. NOTE: this is a
// DISPLAY-ONLY mapping — it does NOT change GL income-account mapping (a
// separate held decision). "charge" → "HOA Dues", "assessment" → "Special
// Assessment". Unknown/future types fall back to a de-kebabed Title Case.
const LEDGER_TYPE_LABEL: Record<string, string> = {
  charge: "HOA Dues",
  assessment: "Special Assessment",
  "late-fee": "Late Fee",
  payment: "Payment",
  credit: "Credit",
  adjustment: "Adjustment",
};

export function ledgerTypeLabel(entryType: string): string {
  const known = LEDGER_TYPE_LABEL[entryType];
  if (known) return known;
  // De-kebab + Title Case fallback for any unmapped/future type.
  return entryType
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// 2026-06-30 — resolve the unit label for a ledger entry from the dashboard's
// `byUnit` breakdown (which carries the resolved `<building>-<unit>` label).
// Owner ledger entries carry only `unitId`; this maps it to the human label so
// the ledger reads cleanly (William finding #5: "which unit is each line for?").
function buildUnitLabelMap(byUnit: FinanceUnitBreakdown[]): Map<string, string> {
  return new Map(byUnit.map((u) => [u.unitId, u.unitLabel]));
}

// 2026-06-30 — "What's due now" breakdown (William finding #3): separate HOA
// dues from special-assessment installments. Dues-due = the positive `charge`
// + `late-fee` category balances summed across units (assessments are EXCLUDED
// here — they're shown as installments, not the lifetime lump). Installment-due
// = the sum of the upcoming installment amounts. Total = dues + installments.
// Pure over its inputs so it can be unit-tested without rendering.
export interface DueNowBreakdown {
  duesDue: number;
  assessmentInstallmentDue: number;
  totalDueNow: number;
}
export function computeDueNow(
  byUnit: Array<{ byCategory: Partial<Record<FinanceCategoryKey, number>> }>,
  upcomingInstallments: Array<{ installmentAmount: number }>,
): DueNowBreakdown {
  const duesDue = byUnit.reduce(
    (sum, u) =>
      sum + Math.max(0, u.byCategory.charge ?? 0) + Math.max(0, u.byCategory["late-fee"] ?? 0),
    0,
  );
  const assessmentInstallmentDue = upcomingInstallments.reduce(
    (sum, i) => sum + (i.installmentAmount ?? 0),
    0,
  );
  return { duesDue, assessmentInstallmentDue, totalDueNow: duesDue + assessmentInstallmentDue };
}

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
  // 2026-07-03 — additive, per-unit dues-vs-assessment breakdown. Sums
  // reconcile exactly to the owner-wide "due now" + balance totals.
  perUnit?: PerUnitBreakdown[];
  grandTotal?: number;
  // 2026-05-25 (live session) — plan-aware "Amount due this period".
  // null when no active payment plan, or when on a quarterly plan and
  // the current quarter isn't closing. The UI uses this to drive the
  // primary CTA distinct from the total balance.
  amountDueThisPeriod?: {
    amount: number;
    periodLabel: string;
    periodEnd: string;
    frequency: "monthly" | "quarterly" | "annual" | string;
    reason: string;
  } | null;
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
  if (path === "/portal/finances/statement") return "Account Statement";
  if (path === "/portal/finances/receipts") return "Payment Receipts";
  if (path.startsWith("/portal/finances/assessments/")) return t("portal.finances.assessment.title");
  return t("portal.finances.title");
}

// ---------- (Plaid owner-pay card removed 2026-06-30) ----------
//
// The owner-side Plaid "connect your bank / pay from bank" card was removed
// from the My Finances hub. Owners now pay through Stripe Checkout (card +
// ACH on the HOA's connected Stripe account) via POST /api/portal/pay
// (Connect-routed in server/services/payment-service.ts). Plaid remains the
// ADMIN bank-feed / reconciliation integration only — it is not an owner
// payment path (William finding #1, 2026-06-30).

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
function PerUnitFinanceCard({
  unit,
  dueBreakdown,
  hasUpcomingInstallments,
}: {
  unit: FinanceUnitBreakdown;
  // 2026-07-03 — per-unit dues-vs-assessment split (from the endpoint's
  // additive `perUnit` array). When present, the expanded body leads with a
  // clean "Due now" + "Total balance" summary that separates HOA dues from
  // special assessments, per William's multi-unit ask.
  dueBreakdown?: PerUnitBreakdown;
  hasUpcomingInstallments?: boolean;
}) {
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
        <div className="flex flex-1 items-center justify-between gap-3 sm:gap-4">
          {/* #217 mobile pass — min-w-0 + truncate so a long unit label can't
              push the balance figure off-screen on a narrow phone. */}
          <div className="min-w-0 text-left">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-on-surface-variant">
              Unit
            </p>
            <p className="truncate font-headline text-lg text-on-surface sm:text-xl" data-testid={`portal-finances-unit-${unit.unitId}-label`}>
              {unit.unitLabel}
            </p>
          </div>
          <div className="shrink-0 text-right">
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
        {/* 2026-07-03 — per-unit "Due now" + "Total balance" split into HOA
            dues vs special assessment (William multi-unit ask). Reconciles to
            the owner-wide totals. Only rendered when the endpoint supplied the
            additive `perUnit` breakdown. */}
        {dueBreakdown ? (
          <div
            className="grid grid-cols-1 gap-4 border-t border-outline-variant/10 pt-4 sm:grid-cols-2"
            data-testid={`portal-finances-unit-${unit.unitId}-split`}
          >
            {/* Due now */}
            <div className="rounded-xl border border-outline-variant/15 bg-surface-container/40 p-4">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-on-surface-variant">
                Due now
              </p>
              <ul className="mt-2 space-y-1.5 text-sm">
                <li className="flex items-center justify-between gap-3">
                  <span className="text-on-surface">HOA Dues</span>
                  <span className="font-medium tabular-nums text-on-surface" data-testid={`portal-finances-unit-${unit.unitId}-duenow-dues`}>
                    ${formatCurrency(dueBreakdown.dueNowDues)}
                  </span>
                </li>
                <li className="flex items-center justify-between gap-3">
                  <span className="text-on-surface">
                    Special Assessment{hasUpcomingInstallments ? " installment" : ""}
                  </span>
                  <span className="font-medium tabular-nums text-primary" data-testid={`portal-finances-unit-${unit.unitId}-duenow-assessment`}>
                    ${formatCurrency(dueBreakdown.dueNowAssessment)}
                  </span>
                </li>
                <li className="flex items-center justify-between gap-3 border-t border-outline-variant/10 pt-1.5">
                  <span className="font-semibold text-on-surface">Total due now</span>
                  <span
                    className={`font-headline tabular-nums ${dueBreakdown.dueNowTotal > 0 ? "text-destructive" : "text-on-surface"}`}
                    data-testid={`portal-finances-unit-${unit.unitId}-duenow-total`}
                  >
                    ${formatCurrency(dueBreakdown.dueNowTotal)}
                  </span>
                </li>
              </ul>
            </div>
            {/* Total balance */}
            <div className="rounded-xl border border-outline-variant/15 bg-surface-container/40 p-4">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-on-surface-variant">
                Total balance
              </p>
              <ul className="mt-2 space-y-1.5 text-sm">
                <li className="flex items-center justify-between gap-3">
                  <span className="text-on-surface">HOA dues &amp; other</span>
                  <span className="font-medium tabular-nums text-on-surface" data-testid={`portal-finances-unit-${unit.unitId}-balance-dues`}>
                    ${formatCurrency(dueBreakdown.balanceDues)}
                  </span>
                </li>
                <li className="flex items-center justify-between gap-3">
                  <span className="text-on-surface">Special Assessment</span>
                  <span className="font-medium tabular-nums text-primary" data-testid={`portal-finances-unit-${unit.unitId}-balance-assessment`}>
                    ${formatCurrency(dueBreakdown.balanceAssessment)}
                  </span>
                </li>
                <li className="flex items-center justify-between gap-3 border-t border-outline-variant/10 pt-1.5">
                  <span className="font-semibold text-on-surface">Total balance</span>
                  <span
                    className={`font-headline tabular-nums ${dueBreakdown.balanceTotal > 0 ? "text-destructive" : "text-on-surface"}`}
                    data-testid={`portal-finances-unit-${unit.unitId}-balance-total`}
                  >
                    ${formatCurrency(dueBreakdown.balanceTotal)}
                  </span>
                </li>
              </ul>
            </div>
            {dueBreakdown.dueNowAssessment > 0 ? (
              <p className="text-xs text-on-surface-variant sm:col-span-2" data-testid={`portal-finances-unit-${unit.unitId}-assessment-note`}>
                Special assessments are billed in installments — only the amount
                due now is shown here, not the full assessment.
              </p>
            ) : null}
          </div>
        ) : null}

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
                      <Badge variant="outline">
                        {ledgerTypeLabel(String(entry.entryType))}
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
  // 2026-06-30 — surface pay-flow errors so the owner sees WHY a payment
  // didn't start, rather than a silently-dead button (William finding #2).
  const [payError, setPayError] = useState<string | null>(null);

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

  // §47-261e — proposed budget summary + reserve statement + ratification status.
  const { data: ratifications = [] } = useQuery<Array<{
    id: string;
    kind: string;
    status: string;
    reserveStatement: string;
    budgetSummary: { total?: number; reserveStatement?: string; lineItems?: Array<{ lineItemName: string; plannedAmount: number }> } | null;
    voteCloseAt: string | null;
    totalOwners: number;
    voteRequired: boolean;
    myVote: string | null;
  }>>({
    queryKey: ["portal/budget-ratifications", session.id],
    queryFn: async () => {
      const res = await portalFetch("/api/portal/budget-ratifications");
      if (!res.ok) return [];
      return res.json();
    },
  });

  const startCheckout = useMutation({
    mutationFn: async (amount: number) => {
      // 2026-06-30 — fix the request/response contract to match the server.
      // `POST /api/portal/pay` (server/routes/payment-portal.ts) expects
      // `{ amountCents: integer, unitId }` and returns `{ checkoutUrl }`.
      // The prior body `{ amount, description }` + `data.url` read silently
      // broke the owner "Pay now" button (400 "amountCents must be a positive
      // integer", and no redirect even on success). Convert dollars→cents and
      // resolve the unit the payment applies to.
      const units = dashboard?.byUnit ?? [];
      // Prefer the single owned unit; for multi-unit owners default to the
      // unit carrying an outstanding balance (oldest/first such), else the
      // first unit. Stripe Checkout still collects the full amount entered.
      const unitId =
        units.length === 1
          ? units[0].unitId
          : (units.find((u) => (u.total ?? 0) > 0)?.unitId ?? units[0]?.unitId);
      if (!unitId) {
        throw new Error("No unit is associated with your account to apply this payment to.");
      }
      const amountCents = Math.round(amount * 100);
      const res = await portalFetch("/api/portal/pay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // 2026-05-25 (live session) — neutral "Online payment" phrase rather
        // than asserting a category the owner didn't pick.
        body: JSON.stringify({ amountCents, unitId, description: "Online payment" }),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json() as Promise<{ checkoutUrl?: string }>;
    },
    onSuccess: (data) => {
      setPayError(null);
      if (data.checkoutUrl) {
        window.location.assign(data.checkoutUrl);
      } else {
        setPayError("Payment could not be started — no checkout link was returned. Please try again.");
      }
      qc.invalidateQueries({ queryKey: ["portal/financial-dashboard"] });
    },
    onError: (err: unknown) => {
      setPayError(err instanceof Error ? err.message : "Payment could not be started. Please try again.");
    },
  });

  const balance = dashboard?.balance ?? 0;
  const upcoming = dashboard?.specialAssessmentUpcomingInstallments ?? [];
  const byUnit = dashboard?.byUnit ?? [];
  const unitLabelMap = useMemo(() => buildUnitLabelMap(byUnit), [byUnit]);
  // 2026-07-03 — per-unit dues-vs-assessment split, keyed by unitId. Only the
  // value-add for MULTI-unit owners; a single-unit owner's split is already
  // covered by the top "What's due now" + "Total balance" cards.
  const perUnitMap = useMemo(
    () => new Map((dashboard?.perUnit ?? []).map((p) => [p.unitId, p])),
    [dashboard?.perUnit],
  );
  const showPerUnitBreakdown = byUnit.length > 1;

  // 2026-06-30 — "What's due now" breakdown (William finding #3): separate HOA
  // dues from special-assessment installments, and show the installment(s)
  // due now — NOT the full assessment lump (an $80k driveway assessment is not
  // all due at once). See `computeDueNow` for the pure logic.
  const { duesDue, assessmentInstallmentDue, totalDueNow } = useMemo(
    () => computeDueNow(byUnit, upcoming),
    [byUnit, upcoming],
  );
  const hasDueNowBreakdown = byUnit.length > 0 || upcoming.length > 0;
  // 2026-05-25 (live session) — server-resolved "Amount due this period".
  // null when no active plan OR mid-quarter on a quarterly plan.
  const amountDueThisPeriod = dashboard?.amountDueThisPeriod ?? null;
  const hasAmountDue =
    amountDueThisPeriod != null && (amountDueThisPeriod.amount ?? 0) > 0;
  // 2026-07-01 (display-only) — "Paid in full" state. When the owner owes
  // nothing right now — no lifetime balance, no installment due this period,
  // and no dues/assessment due-now — present a clear positive "Paid in full"
  // card (with the last payment date when we have it) instead of a bare
  // "$0.00 balance". This is purely presentational: derived from the existing
  // balance + lastPaymentDate; no money logic, no ledger write.
  const paidInFull = balance <= 0 && !hasAmountDue && totalDueNow <= 0;
  const lastPaymentDate = dashboard?.lastPaymentDate ?? null;
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

      {/* 2026-07-01 (display-only) — "Paid in full" state. When the owner owes
          nothing right now, show a clear positive confirmation (with the last
          payment date when available) instead of a $0.00 balance framing. */}
      {paidInFull ? (
        <section data-testid="portal-finances-paid-in-full">
          <Card className="border-primary/30 bg-primary/[0.06]">
            <CardContent className="flex items-start gap-3 py-5">
              <CheckCircle2
                className="mt-0.5 h-6 w-6 shrink-0 text-primary"
                aria-hidden="true"
              />
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-primary">
                  Account status
                </p>
                <p
                  className="mt-1 font-headline text-2xl md:text-3xl text-on-surface"
                  data-testid="portal-finances-paid-in-full-headline"
                >
                  {lastPaymentDate
                    ? `Paid in full on ${new Date(lastPaymentDate).toLocaleDateString()}`
                    : "Paid in full"}
                </p>
                <p className="mt-1 text-sm text-on-surface-variant">
                  {balance < 0
                    ? `You have a credit of $${formatCurrency(balance)} on your account. Nothing is due right now.`
                    : "You have no outstanding balance. Nothing is due right now."}
                </p>
              </div>
            </CardContent>
          </Card>
        </section>
      ) : null}

      {/* 2026-06-30 — "What's due now" breakdown (William finding #3). Separate
          HOA dues from special-assessment installments, and show the installment
          due — NOT the full assessment lump. Total = dues + installment. The
          lifetime balance is shown alongside as a reference, never as "what's
          due". Suppressed when nothing is actually due (paid-in-full) so the
          owner never sees a "$0.00 What's due now" alarm. */}
      {hasDueNowBreakdown && !paidInFull ? (
        <section data-testid="portal-finances-due-now">
          <Card className="border-destructive/30 bg-destructive/[0.04]">
            <CardContent className="py-5">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-destructive">
                What&rsquo;s due now
              </p>
              <p
                className="mt-1 font-headline text-4xl md:text-5xl tabular-nums text-destructive"
                data-testid="portal-finances-due-now-total"
              >
                ${formatCurrency(totalDueNow)}
              </p>
              <div className="mt-4 grid grid-cols-1 gap-x-8 gap-y-2 sm:grid-cols-2">
                <div className="flex items-center justify-between gap-3 border-t border-destructive/10 pt-2">
                  <span className="text-sm text-on-surface">HOA Dues</span>
                  <span
                    className="font-medium tabular-nums text-on-surface"
                    data-testid="portal-finances-due-now-dues"
                  >
                    ${formatCurrency(duesDue)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3 border-t border-destructive/10 pt-2">
                  <span className="text-sm text-on-surface">
                    Special Assessment{upcoming.length > 1 ? " installments" : " installment"}
                  </span>
                  <span
                    className="font-medium tabular-nums text-on-surface"
                    data-testid="portal-finances-due-now-assessment"
                  >
                    ${formatCurrency(assessmentInstallmentDue)}
                  </span>
                </div>
              </div>
              {assessmentInstallmentDue > 0 ? (
                <p
                  className="mt-3 text-xs text-on-surface-variant"
                  data-testid="portal-finances-due-now-note"
                >
                  Special assessments are billed in installments — only the amount
                  due now is shown here, not the full assessment.
                </p>
              ) : null}
            </CardContent>
          </Card>
        </section>
      ) : null}
||||||| parent of c036d16 (feat(financial): Connecticut CGS §47-261e budget ratification (owner-veto / negative option) (#8015))

      {/* §47-261e — proposed budget summary + reserve statement + ratification status */}
      {ratifications.length > 0 && (
        <section className="flex flex-col gap-3" data-testid="portal-budget-ratifications">
          {ratifications.map((r) => (
            <Card key={r.id} className="border-amber-200">
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-on-surface-variant">
                    Proposed budget · Connecticut CGS §47-261e
                  </p>
                  <span className="rounded-full bg-surface-variant px-2 py-0.5 text-xs">{r.status}</span>
                </div>
                {typeof r.budgetSummary?.total === "number" && (
                  <p className="mt-1 font-headline text-2xl tabular-nums">${r.budgetSummary.total.toLocaleString()}</p>
                )}
                <p className="mt-2 text-sm">
                  <span className="font-medium">Statement of reserves:</span> {r.reserveStatement}
                </p>
                <p className="mt-1 text-xs text-on-surface-variant">
                  {r.voteRequired
                    ? `This budget takes effect ${r.voteCloseAt ? `on ${new Date(r.voteCloseAt).toLocaleDateString()}` : ""} unless a majority of all ${r.totalOwners} owners votes to reject it.`
                    : "Approved without an owner vote (below the §47-261e(b) threshold or emergency assessment)."}
                </p>
                {r.myVote && (
                  <p className="mt-1 text-xs text-on-surface-variant">Your recorded vote: <span className="font-medium">{r.myVote}</span></p>
                )}
              </CardContent>
            </Card>
          ))}
        </section>
      )}

      {/* 2026-05-25 (live session) — Balance vs Amount-due distinction.
          William verbatim: the $5,618.61 figure is the TOTAL balance (lifetime),
          NOT what's due right now if the owner is on a payment plan. The
          primary CTA below is "Pay $X due this period"; the total balance
          is shown alongside as a reference. When no plan is active, only
          the total balance is rendered (legacy behavior preserved). When the
          owner is paid in full, this balance-vs-amount-due block is suppressed
          — the "Paid in full" card above already conveys the $0 state without
          a redundant "$0.00 balance". */}
      {!paidInFull ? (
      <section className="grid gap-4 md:grid-cols-2">
        {/* Card 1 — Amount Due This Period (PRIMARY when a plan exists) */}
        {hasAmountDue ? (
          <Card
            className="border-destructive/30 bg-destructive/[0.04]"
            data-testid="portal-finances-amount-due-hero"
          >
            <CardContent className="py-5">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-destructive">
                Amount due this period
              </p>
              <p
                className="mt-1 font-headline text-4xl md:text-5xl tabular-nums text-destructive"
                data-testid="portal-finances-amount-due"
              >
                ${formatCurrency(amountDueThisPeriod!.amount)}
              </p>
              <p className="mt-2 text-xs text-on-surface-variant" data-testid="portal-finances-amount-due-context">
                Installment for {amountDueThisPeriod!.periodLabel}
                {amountDueThisPeriod!.periodEnd ? (
                  <>
                    {" · due by "}
                    {new Date(amountDueThisPeriod!.periodEnd).toLocaleDateString()}
                  </>
                ) : null}
                {amountDueThisPeriod!.frequency ? (
                  <> · {String(amountDueThisPeriod!.frequency)} plan</>
                ) : null}
              </p>
            </CardContent>
          </Card>
        ) : null}

        {/* Card 2 — Total Balance (reference; primary when no plan).
            When a plan IS active, this is secondary — the cream tone
            (vs the destructive tone above) communicates "reference". */}
        <Card
          className={
            hasAmountDue
              ? "border-outline-variant/15 bg-surface"
              : "border-primary/15 bg-primary/[0.06]"
          }
          data-testid="portal-finances-balance-hero"
        >
          <CardContent className="py-5">
            <p
              className={`text-[10px] font-semibold uppercase tracking-widest ${
                hasAmountDue ? "text-on-surface-variant" : "text-primary"
              }`}
            >
              {byUnit.length > 1 ? "Total balance" : t("portal.finances.cards.balanceDue")}
            </p>
            {/* Wave 25 — `text-secondary` resolves to a near-white tone in
                light mode and fails WCAG AA color contrast (axe). When a
                plan is active, this card is secondary; use neutral tone.
                Without a plan, fall back to destructive for non-zero
                balance to keep "you owe money" visible. */}
            <p
              className={`mt-1 font-headline text-4xl md:text-5xl tabular-nums ${
                hasAmountDue
                  ? "text-on-surface"
                  : balance > 0
                    ? "text-destructive"
                    : "text-on-surface"
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
              {hasAmountDue ? (
                <>
                  {(byUnit.length > 0 || dashboard?.nextDueDate) ? " · " : null}
                  Lifetime total across all open charges
                </>
              ) : null}
            </p>
          </CardContent>
        </Card>
      </section>
      ) : null}

      <section className="grid gap-4 md:grid-cols-3">
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
        {/* 2026-05-25 (live session) — surface a visible link to the full
            ledger so the owner doesn't have to scroll past the bank-payment
            card to find it. Mirrors the existing quick-link in the section
            below; this is the eye-level version. */}
        <Link
          href="/portal/finances/ledger"
          className="flex items-center justify-center rounded-xl border border-dashed border-outline-variant/30 px-4 py-5 text-sm font-semibold text-primary hover:border-primary/40 hover:bg-primary/[0.04] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          data-testid="portal-finances-hero-ledger-link"
        >
          <Receipt className="mr-2 h-4 w-4" aria-hidden="true" />
          View full ledger
        </Link>
      </section>

      {/* 2026-06-30 — Owner PAY flow is Stripe (William finding #1). The Plaid
          "connect your bank" card was REMOVED from the owner pay experience —
          owners pay through Stripe Checkout (card + ACH on the HOA's connected
          Stripe account) via POST /api/portal/pay. Plaid stays the admin
          bank-FEED/reconciliation tool only; it is not an owner payment path. */}
      <section className="grid gap-4 md:grid-cols-2">
        <Card data-testid="portal-finances-pay-card">
          <CardContent className="space-y-3 py-5">
            <h2 className="font-headline text-lg" id="portal-finances-make-payment-heading">{t("portal.finances.makePayment.title")}</h2>
            {/* Quick-fill chips: pay what's due now, or the full balance. The
                owner can still type any amount below. */}
            {(totalDueNow > 0 || balance > 0) ? (
              <div className="flex flex-wrap gap-2" data-testid="portal-finances-pay-quickfill">
                {totalDueNow > 0 ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setPaymentAmount(totalDueNow.toFixed(2))}
                    data-testid="portal-finances-pay-fill-due"
                  >
                    Due now (${formatCurrency(totalDueNow)})
                  </Button>
                ) : null}
                {balance > 0 ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setPaymentAmount(balance.toFixed(2))}
                    data-testid="portal-finances-pay-fill-balance"
                  >
                    Full balance (${formatCurrency(balance)})
                  </Button>
                ) : null}
              </div>
            ) : null}
            {/* #217 mobile pass — amount field + Pay button stack on phones so
                the input isn't squeezed beside the CTA at 320–375px, and each
                is a comfortable 44px tap target; inline on ≥sm. */}
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                placeholder={t("portal.finances.makePayment.amountPlaceholder")}
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                data-testid="portal-finances-amount-input"
                aria-labelledby="portal-finances-make-payment-heading"
                aria-label={t("portal.finances.makePayment.amountPlaceholder")}
                className="h-11 text-base sm:flex-1"
              />
              <Button
                onClick={() => {
                  setPayError(null);
                  const amt = Number(paymentAmount);
                  if (Number.isFinite(amt) && amt > 0) startCheckout.mutate(amt);
                }}
                disabled={startCheckout.isPending || !paymentAmount}
                data-testid="portal-finances-pay-now"
                className="min-h-11 w-full sm:w-auto"
              >
                {startCheckout.isPending ? t("portal.finances.makePayment.redirecting") : t("portal.finances.makePayment.cta")}
              </Button>
            </div>
            {payError ? (
              <p className="text-xs text-destructive" role="alert" data-testid="portal-finances-pay-error">
                {payError}
              </p>
            ) : null}
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
              <Link
                href="/portal/finances/statement"
                className="flex items-center justify-between rounded-lg border border-outline-variant/10 px-4 py-3 text-sm font-semibold hover:bg-surface-container focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                data-testid="portal-finances-link-statement"
              >
                Account statement
                <span className="material-symbols-outlined text-base" aria-hidden="true">arrow_forward</span>
              </Link>
              <Link
                href="/portal/finances/receipts"
                className="flex items-center justify-between rounded-lg border border-outline-variant/10 px-4 py-3 text-sm font-semibold hover:bg-surface-container focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                data-testid="portal-finances-link-receipts"
              >
                Payment receipts
                <span className="material-symbols-outlined text-base" aria-hidden="true">arrow_forward</span>
              </Link>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* 2026-07-03 — the per-unit breakdown is the value-add for MULTI-unit
          owners. A single-unit owner's dues-vs-assessment split is already
          covered by the top "What's due now" + "Total balance" cards, so the
          section is hidden for them (don't clutter the single-unit case). */}
      {showPerUnitBreakdown ? (
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
                {`What each of your ${byUnit.length} units owes — HOA dues and special assessments shown separately.`}
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
              <PerUnitFinanceCard
                key={unit.unitId}
                unit={unit}
                dueBreakdown={perUnitMap.get(unit.unitId)}
                hasUpcomingInstallments={upcoming.length > 0}
              />
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
                    {byUnit.length > 1 ? <TableHead>{t("portal.finances.col.unit")}</TableHead> : null}
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
                      <TableCell className="text-xs">
                        <Badge variant="outline">{ledgerTypeLabel(entry.entryType)}</Badge>
                      </TableCell>
                      {byUnit.length > 1 ? (
                        <TableCell className="text-xs text-on-surface-variant">
                          {unitLabelMap.get(entry.unitId) ?? "—"}
                        </TableCell>
                      ) : null}
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
  // 2026-06-30 — surface setup errors so "Add method" is never a silent dead
  // button (William finding #2). The button previously 400'd for Connect
  // associations (no manual key) with no UI feedback.
  const [setupError, setSetupError] = useState<string | null>(null);

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
      // 2026-06-30 — the server returns `{ checkoutUrl, sessionId }` (Stripe
      // setup-mode Checkout). The prior client read `data.url` which never
      // matched, so even a successful setup didn't redirect. Read both shapes.
      return res.json() as Promise<{ checkoutUrl?: string; url?: string }>;
    },
    onSuccess: (data) => {
      setSetupError(null);
      const url = data.checkoutUrl ?? data.url;
      if (url) {
        window.location.assign(url);
      } else {
        setSetupError("Could not open payment setup — no checkout link was returned. Please try again.");
      }
    },
    onError: (err: unknown) => {
      setSetupError(err instanceof Error ? err.message : "Could not open payment setup. Please try again.");
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
      {/* #217 mobile pass — title + Add button stack on phones (the Add CTA
          goes full-width, 44px tall) so they don't collide on a narrow
          viewport; inline row on ≥sm. */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-headline text-3xl" data-testid="portal-finances-payment-methods-heading">
            {t("portal.finances.paymentMethods.title")}
          </h1>
          <p className="mt-1 text-sm text-on-surface-variant">
            {t("portal.finances.paymentMethods.subtitle")}
          </p>
        </div>
        <Button
          onClick={() => setupMethod.mutate()}
          disabled={setupMethod.isPending}
          data-testid="portal-finances-add-method"
          className="min-h-11 w-full sm:w-auto"
        >
          {setupMethod.isPending ? t("portal.finances.paymentMethods.opening") : t("portal.finances.paymentMethods.add")}
        </Button>
      </div>

      {setupError ? (
        <p className="text-sm text-destructive" role="alert" data-testid="portal-finances-add-method-error">
          {setupError}
        </p>
      ) : null}

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
                {/* #217 mobile pass — stack the bank label above its actions on
                    phones so two buttons + the account label don't crowd at
                    320–375px; inline row on ≥sm. */}
                <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
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

  // 2026-06-30 — load the dashboard's per-unit breakdown (cached; same query
  // key as the hub) so the full ledger can attribute each row to its unit
  // (William finding #5). Owner ledger entries carry only `unitId`.
  const { data: dashboard } = useQuery<FinancialDashboard>({
    queryKey: ["portal/financial-dashboard", session.id],
    queryFn: async () => {
      const res = await portalFetch("/api/portal/financial-dashboard");
      if (!res.ok) throw new Error("Failed to load dashboard");
      return res.json();
    },
  });
  const byUnit = dashboard?.byUnit ?? [];
  const unitLabelMap = useMemo(() => buildUnitLabelMap(byUnit), [byUnit]);
  const showUnitColumn = byUnit.length > 1;

  const filtered = useMemo(
    () => (typeFilter === "all" ? ledger : ledger.filter((l) => l.entryType === typeFilter)),
    [ledger, typeFilter],
  );

  const typeOptions = ["all", "charge", "assessment", "payment", "late-fee", "credit", "adjustment"];
  const typeOptionLabel = (opt: string) => (opt === "all" ? "All" : ledgerTypeLabel(opt));

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
            className={`rounded-full px-3 py-1 text-xs font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${
              typeFilter === opt ? "bg-primary text-on-primary" : "bg-surface-container text-on-surface-variant"
            }`}
            data-testid={`portal-finances-ledger-filter-${opt}`}
          >
            {typeOptionLabel(opt)}
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
              <VirtualizedPortalLedger
                entries={filtered}
                unitLabelMap={showUnitColumn ? unitLabelMap : undefined}
              />
            ) : (
              <Table aria-label={t("portal.finances.ledger.title")}>
                <caption className="sr-only">{t("portal.finances.ledger.title")}</caption>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("portal.finances.col.date")}</TableHead>
                    <TableHead>{t("portal.finances.col.type")}</TableHead>
                    {showUnitColumn ? <TableHead>{t("portal.finances.col.unit")}</TableHead> : null}
                    <TableHead>{t("portal.finances.col.description")}</TableHead>
                    <TableHead className="text-right">{t("portal.finances.col.amount")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={showUnitColumn ? 5 : 4} className="py-6 text-center text-sm text-on-surface-variant">
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
                          <Badge variant="outline">{ledgerTypeLabel(entry.entryType)}</Badge>
                        </TableCell>
                        {showUnitColumn ? (
                          <TableCell className="text-xs text-on-surface-variant">
                            {unitLabelMap.get(entry.unitId) ?? "—"}
                          </TableCell>
                        ) : null}
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

// ---------- Sub-page: account statement (P0-3 / #206) ----------
//
// The owner picks a period (defaults to last full calendar month) and gets a
// printable statement: opening balance → in-period activity → closing balance.
// Server scopes to the portal session's personId, so an owner can only ever
// see their OWN statement.

function StatementContent() {
  const { portalFetch, session } = usePortalContext();
  const initial = useMemo(() => defaultStatementPeriod(), []);
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  // The applied period drives the query; editing the inputs doesn't refetch
  // until "Generate" is clicked (avoids a request per keystroke).
  const [applied, setApplied] = useState<{ from: string; to: string }>(initial);

  const { data: statement, isLoading, isError } = useQuery<AccountStatementResponse>({
    queryKey: ["portal/statement", session.id, applied.from, applied.to],
    queryFn: async () => {
      const res = await portalFetch(
        `/api/portal/statement?from=${encodeURIComponent(applied.from)}&to=${encodeURIComponent(applied.to)}`,
      );
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    enabled: Boolean(applied.from && applied.to),
  });

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6" data-testid="portal-finances-statement">
      <div>
        <Link
          href="/portal/finances"
          className="rounded text-xs font-semibold text-primary hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          ← Back to My Finances
        </Link>
      </div>
      <div>
        <h1 className="font-headline text-3xl" data-testid="portal-finances-statement-heading">
          Account Statement
        </h1>
        <p className="mt-1 text-sm text-on-surface-variant">
          Generate a printable statement for any period — opening balance,
          activity, and closing balance.
        </p>
      </div>

      {/* Period picker */}
      <Card className="no-print">
        {/* #217 mobile pass — date fields go full-width + 44px tall on phones
            (native date pickers are easier to tap), Generate is full-width;
            inline row on ≥sm. */}
        <CardContent className="flex flex-col gap-3 py-5 sm:flex-row sm:items-end">
          <div className="flex flex-col gap-1 sm:flex-1">
            <label htmlFor="statement-from" className="text-xs font-semibold text-on-surface-variant">
              From
            </label>
            <Input
              id="statement-from"
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              data-testid="portal-statement-from"
              className="h-11 text-base sm:h-9 sm:text-sm"
            />
          </div>
          <div className="flex flex-col gap-1 sm:flex-1">
            <label htmlFor="statement-to" className="text-xs font-semibold text-on-surface-variant">
              To
            </label>
            <Input
              id="statement-to"
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              data-testid="portal-statement-to"
              className="h-11 text-base sm:h-9 sm:text-sm"
            />
          </div>
          <Button
            onClick={() => setApplied({ from, to })}
            disabled={!from || !to || from > to}
            data-testid="portal-statement-generate"
            className="min-h-11 w-full sm:w-auto"
          >
            Generate
          </Button>
        </CardContent>
      </Card>

      {isLoading ? (
        <Card>
          <CardContent className="py-6 text-sm text-on-surface-variant" role="status">
            Generating statement…
          </CardContent>
        </Card>
      ) : isError ? (
        <Card>
          <CardContent className="py-6 text-sm text-destructive" role="alert">
            Could not generate the statement. Check the dates and try again.
          </CardContent>
        </Card>
      ) : statement ? (
        <AccountStatementView statement={statement} />
      ) : null}
    </div>
  );
}

// ---------- 5.4-F7: Virtualized portal ledger ---------------------------
//
// When `filtered.length > LEDGER_VIRTUALIZE_THRESHOLD`, the LedgerContent
// component swaps to this div-grid layout so only the rows in view are
// kept in the DOM. The visual columns mirror the legacy `<Table>` exactly:
// Date / Type / Description / right-aligned Amount.

function VirtualizedPortalLedger({
  entries,
  unitLabelMap,
}: {
  entries: OwnerLedgerEntry[];
  unitLabelMap?: Map<string, string>;
}) {
  const showUnit = !!unitLabelMap;
  const gridTemplate = showUnit
    ? "minmax(90px, 110px) minmax(90px, 130px) minmax(80px, 120px) minmax(150px, 1fr) minmax(80px, 110px)"
    : "minmax(90px, 110px) minmax(90px, 130px) minmax(150px, 1fr) minmax(80px, 110px)";
  return (
    <div data-testid="portal-finances-ledger-virtualized" role="table" aria-label={t("portal.finances.ledger.title")}>
      <div
        className="grid border-b text-xs font-medium uppercase tracking-wide text-on-surface-variant"
        style={{ gridTemplateColumns: gridTemplate }}
        role="row"
      >
        <div className="px-4 py-3" role="columnheader">{t("portal.finances.col.date")}</div>
        <div className="px-4 py-3" role="columnheader">{t("portal.finances.col.type")}</div>
        {showUnit ? <div className="px-4 py-3" role="columnheader">{t("portal.finances.col.unit")}</div> : null}
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
              <Badge variant="outline">{ledgerTypeLabel(entry.entryType)}</Badge>
            </div>
            {showUnit ? (
              <div className="truncate px-4 py-3 text-on-surface-variant">
                {unitLabelMap?.get(entry.unitId) ?? "—"}
              </div>
            ) : null}
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

// ---------- Sub-page: payment receipts list (P0-2 / #205) ----------

interface ReceiptSummary {
  id: string;
  receiptReference: string;
  amountFormatted: string;
  description: string;
  paidAtFormatted: string;
  confirmedAt: string;
}

function ReceiptsContent() {
  const { portalFetch } = usePortalContext();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data, isLoading, isError } = useQuery<{ receipts: ReceiptSummary[] }>({
    queryKey: ["portal/receipts"],
    queryFn: async () => {
      const res = await portalFetch("/api/portal/receipts");
      if (!res.ok) return { receipts: [] };
      return res.json() as Promise<{ receipts: ReceiptSummary[] }>;
    },
  });

  const { data: receiptDetail, isLoading: detailLoading } = useQuery<PaymentReceiptData>({
    queryKey: ["portal/receipts", selectedId],
    queryFn: async () => {
      const res = await portalFetch(`/api/portal/receipts/${selectedId}`);
      if (!res.ok) throw new Error("Receipt not found");
      return res.json() as Promise<PaymentReceiptData>;
    },
    enabled: selectedId != null,
  });

  if (selectedId) {
    return (
      <div className="mx-auto flex max-w-3xl flex-col gap-4" data-testid="portal-finances-receipt-detail">
        <div>
          <button
            type="button"
            onClick={() => setSelectedId(null)}
            className="rounded text-xs font-semibold text-primary hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            data-testid="portal-receipt-back"
          >
            ← Back to receipts
          </button>
        </div>
        {detailLoading || receiptDetail == null ? (
          <p className="text-sm text-on-surface-variant">Loading receipt…</p>
        ) : (
          <PaymentReceiptView receipt={receiptDetail as PaymentReceiptData} />
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6" data-testid="portal-finances-receipts">
      <div className="flex items-center gap-3">
        <Receipt className="h-6 w-6 text-primary" aria-hidden="true" />
        <h1 className="font-headline text-3xl" data-testid="portal-finances-receipts-heading">
          Payment Receipts
        </h1>
      </div>
      <p className="text-sm text-on-surface-variant">
        Downloadable and printable receipts for all your settled HOA payments.
      </p>

      {isLoading ? (
        <p className="text-sm text-on-surface-variant">Loading receipts…</p>
      ) : isError ? (
        <p className="text-sm text-destructive">Failed to load receipts.</p>
      ) : !data?.receipts.length ? (
        <EmptyState
          icon={Receipt}
          title="No receipts yet"
          description="Receipts will appear here once you have settled payments."
        />
      ) : (
        <>
          {/* #217 mobile pass — the 5-column receipts table overflows on
              phones (Date / Amount / Description / Receipt # / Download), so
              below sm it renders as a stacked card list with a full-width
              tappable action; the table returns at ≥sm. */}
          <ul
            className="flex flex-col gap-3 sm:hidden"
            data-testid="portal-finances-receipts-cards"
          >
            {(data?.receipts ?? []).map((r: ReceiptSummary) => (
              <li key={r.id}>
                <Card data-testid={`portal-receipt-card-${r.id}`}>
                  <CardContent className="space-y-2 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold">{r.paidAtFormatted}</p>
                        <p className="truncate text-xs text-on-surface-variant">{r.description}</p>
                      </div>
                      <p className="shrink-0 text-base font-semibold tabular-nums">{r.amountFormatted}</p>
                    </div>
                    <p className="font-mono text-[11px] text-on-surface-variant">
                      Receipt {r.receiptReference}
                    </p>
                    <Button
                      variant="outline"
                      onClick={() => setSelectedId(r.id)}
                      data-testid={`portal-receipt-view-mobile-${r.id}`}
                      className="min-h-11 w-full no-print"
                    >
                      View / Print
                    </Button>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>

          <Card className="hidden sm:block">
            <CardContent className="py-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Receipt #</TableHead>
                    <TableHead className="text-right no-print">Download</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(data?.receipts ?? []).map((r: ReceiptSummary) => (
                    <TableRow key={r.id} data-testid={`portal-receipt-row-${r.id}`}>
                      <TableCell>{r.paidAtFormatted}</TableCell>
                      <TableCell className="tabular-nums">{r.amountFormatted}</TableCell>
                      <TableCell>{r.description}</TableCell>
                      <TableCell className="font-mono text-xs">{r.receiptReference}</TableCell>
                      <TableCell className="text-right no-print">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedId(r.id)}
                          data-testid={`portal-receipt-view-${r.id}`}
                        >
                          View / Print
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

// ---------- Router entry point ----------

export default function PortalFinancesPage({
  subPath,
  assessmentId,
}: {
  subPath?: "hub" | "payment-methods" | "ledger" | "statement" | "assessment" | "receipts";
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
  } else if (subPath === "statement") {
    body = <StatementContent />;
  } else if (subPath === "receipts") {
    body = <ReceiptsContent />;
  } else if (subPath === "assessment" && assessmentId) {
    body = <AssessmentDetailContent assessmentId={assessmentId} />;
  } else {
    body = <FinancesHubContent />;
  }

  return <PortalShell>{body}</PortalShell>;
}

export {
  FinancesHubContent,
  PaymentMethodsContent,
  LedgerContent,
  StatementContent,
  ReceiptsContent,
  AssessmentDetailContent,
};
