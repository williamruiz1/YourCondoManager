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
import {
  deriveAssessmentPlanView,
  type AssessmentPlanProgress,
} from "@shared/portal-assessment-plan";
import type { PerUnitBreakdown } from "@shared/portal-per-unit";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";

// ── CT convenience-fee preview (founder-os
// wiki/research/chc-processing-fee-legality-2026-07-14.md §6) ─────────────
//
// GET /api/portal/payment-fee-preview?amountCents=N — server-computed so the
// fee formula lives in exactly one place (server/services/convenience-fee.ts).
// Returns cardFeeEnabled: false (feeCents: 0) for every association until
// its flag is explicitly turned on — so this hook is safe to call
// unconditionally; the picker UI it drives only renders when enabled.
interface PaymentFeePreview {
  assessmentCents: number;
  cardFeeEnabled: boolean;
  cardFeeCents: number;
  cardTotalCents: number;
  achFeeCents: number;
  achTotalCents: number;
}

function usePaymentFeePreview(amountDollars: number) {
  const { portalFetch } = usePortalContext();
  const amountCents = Math.round((Number.isFinite(amountDollars) ? amountDollars : 0) * 100);
  return useQuery<PaymentFeePreview>({
    queryKey: ["portal/payment-fee-preview", amountCents],
    queryFn: async () => {
      const res = await portalFetch(`/api/portal/payment-fee-preview?amountCents=${amountCents}`);
      if (!res.ok) {
        // Fail closed to "no fee, ACH only" — never block or mis-price a
        // payment because the preview endpoint hiccuped.
        return {
          assessmentCents: amountCents,
          cardFeeEnabled: false,
          cardFeeCents: 0,
          cardTotalCents: amountCents,
          achFeeCents: 0,
          achTotalCents: amountCents,
        };
      }
      return res.json();
    },
    enabled: amountCents > 0,
    staleTime: 60_000,
  });
}

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
  // 2026-07-09 — special-assessment payment-PLAN progress (additive,
  // display-only). Drives the owner-portal "payment plan" card so the
  // assessment reads as paid-over-time, not an alarming lump balance.
  assessmentPlans?: AssessmentPlanProgress[];
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

// Owner-facing budget surface — CT CGS §47-261e negative-option (owner-veto)
// budget ratification (#8015). Shows the owner the proposed budget / special
// assessments awaiting (or resolved by) the statutory ratification vote, and
// explains their negative-option veto right.
interface PortalBudgetRatification {
  id: string;
  ratificationType: "annual-budget" | "special-assessment" | "emergency-assessment";
  statuteCitation: string;
  status: string;
  outcome: string | null;
  meetingDate: string | null;
  votingWindowMinDate: string | null;
  votingWindowMaxDate: string | null;
  reserveStatement: string | null;
  assessmentAmount: number | null;
  totalOwnerCount: number;
  rejectThresholdCount: number | null;
  rejectVoteCount: number;
}

const RATIFICATION_TYPE_LABEL: Record<string, string> = {
  "annual-budget": "Annual budget",
  "special-assessment": "Special assessment",
  "emergency-assessment": "Emergency assessment",
};
const RATIFICATION_STATUS_LABEL: Record<string, string> = {
  "summary-distributed": "Awaiting ratification vote",
  "voting-open": "Ratification vote open",
  ratified: "Ratified",
  rejected: "Rejected — prior budget continues",
  "imposed-no-vote": "Imposed (below 15% — no owner vote)",
  "emergency-imposed": "Emergency — imposed immediately",
};

function fmtRatDate(s: string | null): string {
  if (!s) return "—";
  return new Date(s).toISOString().slice(0, 10);
}

function PortalBudgetRatificationCard() {
  const { portalFetch } = usePortalContext();
  const { data, isLoading } = useQuery<PortalBudgetRatification[]>({
    queryKey: ["portal/budget-ratifications"],
    queryFn: async () => {
      const res = await portalFetch("/api/portal/budget-ratifications");
      if (!res.ok) return [];
      const json = await res.json();
      // A non-array body (error object, auth shell) must not crash the whole finances page.
      return Array.isArray(json) ? (json as PortalBudgetRatification[]) : [];
    },
  });

  if (isLoading) return null;
  // Defense-in-depth (#380): guard the render site against a non-array `data`
  // (e.g. `{}`), not just `undefined` — `({}).length === 0` is false and would
  // otherwise fall through to `data.map(...)` and crash the finances page.
  if (!Array.isArray(data) || data.length === 0) return null;

  return (
    <Card data-testid="portal-budget-ratification">
      <CardContent className="space-y-4 py-5">
        <div>
          <h2 className="font-headline text-lg">Budget ratification</h2>
          <p className="text-sm text-muted-foreground">
            Under Connecticut law (CGS §47-261e), an adopted budget is ratified <strong>unless a majority of all
            unit owners rejects it</strong> at the ratification meeting. If you do nothing, the budget takes effect.
          </p>
        </div>
        <ul className="space-y-3">
          {data.map((r) => (
            <li key={r.id} className="rounded-lg border p-3" data-testid={`portal-ratification-${r.id}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium">{RATIFICATION_TYPE_LABEL[r.ratificationType] ?? r.ratificationType}</span>
                <Badge variant="outline">{RATIFICATION_STATUS_LABEL[r.status] ?? r.status}</Badge>
              </div>
              <div className="mt-1 text-xs text-muted-foreground">{r.statuteCitation}</div>
              {r.assessmentAmount != null && (
                <div className="mt-1 text-sm">Assessment: ${r.assessmentAmount.toLocaleString("en-US")}</div>
              )}
              {(r.status === "summary-distributed" || r.status === "voting-open") && (
                <div className="mt-2 space-y-1 text-sm">
                  <div>Ratification meeting: <strong>{fmtRatDate(r.meetingDate)}</strong></div>
                  <div className="text-muted-foreground">
                    Window: {fmtRatDate(r.votingWindowMinDate)} – {fmtRatDate(r.votingWindowMaxDate)} (10–60 days after the summary)
                  </div>
                  {r.rejectThresholdCount != null && (
                    <div className="text-muted-foreground">
                      It takes <strong>{r.rejectThresholdCount}</strong> of {r.totalOwnerCount} owners to reject; {r.rejectVoteCount} have rejected so far.
                    </div>
                  )}
                </div>
              )}
              {r.reserveStatement && (
                <div className="mt-2 text-xs text-muted-foreground">{r.reserveStatement}</div>
              )}
            </li>
          ))}
        </ul>
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

// Format a signed dollar amount so any credit/payment (negative) row still
// reconciles to its column total, rather than showing an abs magnitude.
function signedCurrency(amount: number): string {
  return `${amount < 0 ? "-" : ""}$${formatCurrency(amount)}`;
}

// ---------- Per-unit TRANSPOSED breakdown (2026-07-03) ----------
//
// William ask (2026-07-03): flip the per-unit finances table so each UNIT is a
// COLUMN and the line items (HOA Dues / Special Assessment / Total) are ROWS,
// with a final "All units" / total column that sums across. Shown for EVERY
// owner — including single-unit owners (a clean unit + total two-column table).
// Both groups the endpoint supplies are preserved as row-groups: a "Due now"
// group (what's owed right now — dues + the special-assessment INSTALLMENT, not
// the full lump) and a "Total balance" group. Pure display over the additive
// `perUnit` array; reconciles by construction to the owner-wide due-now +
// balance totals.
function PerUnitTransposedTable({
  units,
  hasUpcomingInstallments,
}: {
  units: PerUnitBreakdown[];
  hasUpcomingInstallments?: boolean;
}) {
  // Column-wise sums across every owned unit → the "All units" / total column.
  const across = {
    dueNowDues: units.reduce((s, u) => s + u.dueNowDues, 0),
    dueNowAssessment: units.reduce((s, u) => s + u.dueNowAssessment, 0),
    dueNowTotal: units.reduce((s, u) => s + u.dueNowTotal, 0),
    balanceDues: units.reduce((s, u) => s + u.balanceDues, 0),
    balanceAssessment: units.reduce((s, u) => s + u.balanceAssessment, 0),
    balanceTotal: units.reduce((s, u) => s + u.balanceTotal, 0),
  };

  type Row = {
    label: string;
    get: (u: PerUnitBreakdown) => number;
    acrossValue: number;
    // `emphasis` marks each group's Total row (bolder; teal accent on the
    // grand total).
    emphasis?: boolean;
  };
  const dueNowRows: Row[] = [
    { label: "HOA Dues", get: (u) => u.dueNowDues, acrossValue: across.dueNowDues },
    {
      label: `Special Assessment${hasUpcomingInstallments ? " installment" : ""}`,
      get: (u) => u.dueNowAssessment,
      acrossValue: across.dueNowAssessment,
    },
    { label: "Total due now", get: (u) => u.dueNowTotal, acrossValue: across.dueNowTotal, emphasis: true },
  ];
  const balanceRows: Row[] = [
    { label: "HOA Dues", get: (u) => u.balanceDues, acrossValue: across.balanceDues },
    { label: "Special Assessment", get: (u) => u.balanceAssessment, acrossValue: across.balanceAssessment },
    { label: "Total balance", get: (u) => u.balanceTotal, acrossValue: across.balanceTotal, emphasis: true },
  ];

  const multiUnit = units.length > 1;
  const totalColLabel = multiUnit ? "All units" : "Total";
  // Sticky first column so the line-item labels stay visible while the unit
  // columns scroll horizontally on a narrow phone.
  const stickyCell = "sticky left-0 z-10 bg-surface";
  // total column always present (unit + total, even for a single-unit owner).
  const colCount = units.length + 2;

  const renderRow = (row: Row, key: string) => (
    <TableRow key={key} className={row.emphasis ? "border-t border-outline-variant/20" : undefined}>
      <TableCell
        className={`${stickyCell} whitespace-nowrap text-sm ${row.emphasis ? "font-semibold text-on-surface" : "text-on-surface-variant"}`}
      >
        {row.label}
      </TableCell>
      {units.map((u) => (
        <TableCell
          key={u.unitId}
          className={`text-right tabular-nums text-sm ${row.emphasis ? "font-semibold text-on-surface" : "text-on-surface"}`}
          data-testid={`portal-finances-transpose-cell-${u.unitId}-${key}`}
        >
          {signedCurrency(row.get(u))}
        </TableCell>
      ))}
      <TableCell
        className={`text-right tabular-nums text-sm ${row.emphasis ? "font-semibold text-primary" : "font-medium text-on-surface"}`}
        data-testid={`portal-finances-transpose-cell-all-${key}`}
      >
        {signedCurrency(row.acrossValue)}
      </TableCell>
    </TableRow>
  );

  const groupHeader = (label: string, key: string) => (
    <TableRow key={key} className="bg-surface-container/40">
      <TableCell
        colSpan={colCount}
        className={`${stickyCell} bg-surface-container/40 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-on-surface-variant`}
      >
        {label}
      </TableCell>
    </TableRow>
  );

  return (
    <div className="space-y-2">
      <Card>
        {/* Horizontal scroll on narrow screens so many unit columns never burst
            the layout — the table scrolls inside its own container. */}
        <CardContent className="p-0 overflow-x-auto">
          <Table data-testid="portal-finances-by-unit-transpose">
            <caption className="sr-only">Per-unit finances — HOA dues and special assessments by unit.</caption>
            <TableHeader>
              <TableRow>
                <TableHead className={`${stickyCell} whitespace-nowrap`} scope="col">
                  Line item
                </TableHead>
                {units.map((u) => (
                  <TableHead
                    key={u.unitId}
                    scope="col"
                    className="whitespace-nowrap text-right"
                    data-testid={`portal-finances-transpose-col-${u.unitId}`}
                  >
                    {u.unitLabel}
                  </TableHead>
                ))}
                <TableHead
                  scope="col"
                  className="whitespace-nowrap text-right text-primary"
                  data-testid="portal-finances-transpose-col-all"
                >
                  {totalColLabel}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {groupHeader("Due now", "group-duenow")}
              {dueNowRows.map((r, i) => renderRow(r, `duenow-${i}`))}
              {groupHeader("Total balance", "group-balance")}
              {balanceRows.map((r, i) => renderRow(r, `balance-${i}`))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      {across.dueNowAssessment > 0 ? (
        <p className="text-xs text-on-surface-variant" data-testid="portal-finances-transpose-note">
          Special assessments are billed in installments — the &ldquo;Due now&rdquo; assessment is
          only the current installment, not the full assessment shown under Total balance.
        </p>
      ) : null}
    </div>
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
  // CT convenience-fee structure (founder-os
  // wiki/research/chc-processing-fee-legality-2026-07-14.md §6). Shared
  // across the hero "Pay this period" CTA and the custom-amount CTA below —
  // only rendered as a picker when the association's card-fee flag is on
  // (see the fee-preview query); defaults to "ach" (today's only option)
  // everywhere else, so the UI is byte-identical when the flag is off.
  const [paymentMethod, setPaymentMethod] = useState<"ach" | "card">("ach");

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
    mutationFn: async ({ amount, method }: { amount: number; method: "ach" | "card" }) => {
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
        // CT convenience-fee structure (memo §6) — `paymentMethod: "card"`
        // only takes effect when the association's fee flag is on; the
        // server rejects it otherwise (400), which the picker below never
        // lets happen since it only offers "card" when the preview says
        // it's enabled.
        body: JSON.stringify({ amountCents, unitId, description: "Online payment", paymentMethod: method }),
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
  // 2026-07-03 — per-unit dues-vs-assessment breakdown (from the endpoint's
  // additive `perUnit` array). Rendered as a TRANSPOSED table (units = columns,
  // line items = rows) for EVERY owner, single-unit included (William ask
  // 2026-07-03). Sums reconcile to the owner-wide due-now + balance totals.
  const perUnit = dashboard?.perUnit ?? [];

  // 2026-06-30 — "What's due now" breakdown (William finding #3): separate HOA
  // dues from special-assessment installments, and show the installment(s)
  // due now — NOT the full assessment lump (an $80k driveway assessment is not
  // all due at once). See `computeDueNow` for the pure logic.
  const { duesDue, assessmentInstallmentDue, totalDueNow } = useMemo(
    () => computeDueNow(byUnit, upcoming),
    [byUnit, upcoming],
  );
  // CT convenience-fee structure (memo §6) — preview for the hero "Pay this
  // period" amount. `cardFeeEnabled` is false for every association until
  // its flag is explicitly turned on, so the picker below stays hidden and
  // the hero CTA is byte-identical to today everywhere except an explicitly
  // enabled association.
  const heroFeePreview = usePaymentFeePreview(totalDueNow);
  const heroCardFeeEnabled = heroFeePreview.data?.cardFeeEnabled ?? false;
  const heroAmountForMethod =
    paymentMethod === "card" && heroFeePreview.data
      ? heroFeePreview.data.cardTotalCents / 100
      : totalDueNow;
  // Same preview, scoped to whatever the owner has typed in the custom-amount
  // box below (0 while empty/invalid — the hook no-ops when amountCents <= 0).
  const customFeePreview = usePaymentFeePreview(Number(paymentAmount) || 0);
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

  // 2026-07-09 (owner-finances redesign) — special-assessment payment PLANS.
  // Shown as progress plans (total · paid · remaining "over time" · installments
  // · next installment), NEVER a big red balance. Red is reserved for a
  // genuinely PAST-DUE installment (deriveAssessmentPlanView.isPastDue).
  const assessmentPlans = dashboard?.assessmentPlans ?? [];
  const planViews = useMemo(
    () => assessmentPlans.map((plan) => ({ plan, view: deriveAssessmentPlanView(plan) })),
    [assessmentPlans],
  );
  // Red is reserved for genuinely past-due only (William requirement #3).
  const hasPastDue = planViews.some((pv) => pv.view.isPastDue);
  // Total remaining special-assessment obligation across all plans — CONTEXT
  // only ("paid over time — not due now"), never framed as an amount due today.
  const totalRemainingOverTime = assessmentPlans.reduce((s, p) => s + p.remaining, 0);
  const thisPeriodLabel = new Date().toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });

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
      {/* ============ HERO: PAY THIS PERIOD (2026-07-09 redesign) ============
          William, repeatedly: LEAD with what's actually due THIS period — this
          month's dues + this month's assessment INSTALLMENT — in a calm BRAND
          treatment (deep teal), never a big red "balance". The full special
          assessment is shown as a payment PLAN below, not lumped into this
          figure. Red is reserved for a genuinely PAST-DUE installment. */}
      {paidInFull ? (
        <section data-testid="portal-finances-paid-in-full">
          <Card className="border-primary/30 bg-primary/[0.06]">
            <CardContent className="flex items-start gap-3 py-6">
              <CheckCircle2
                className="mt-0.5 h-6 w-6 shrink-0 text-primary"
                aria-hidden="true"
              />
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-primary">
                  You&rsquo;re all caught up
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
                    : "Nothing is due this period. Thanks for staying on top of it."}
                </p>
              </div>
            </CardContent>
          </Card>
        </section>
      ) : (
        <section data-testid="portal-finances-pay-this-period">
          <Card
            className={`overflow-hidden ${
              hasPastDue ? "border-destructive/40 bg-destructive/[0.04]" : "border-primary/25 bg-primary/[0.04]"
            }`}
          >
            <CardContent className="py-6">
              {/* status row — reassuring by default; red only when past due */}
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                {hasPastDue ? (
                  <span
                    className="inline-flex items-center gap-1.5 rounded-full bg-destructive/10 px-3 py-1 text-xs font-semibold text-destructive"
                    data-testid="portal-finances-status-chip"
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-destructive" aria-hidden="true" />
                    Past due — please pay
                  </span>
                ) : (
                  <span
                    className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800"
                    data-testid="portal-finances-status-chip"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                    You&rsquo;re on track
                  </span>
                )}
                <span className="text-sm text-on-surface-variant">
                  {hasPastDue
                    ? "An amount is past due — here's what's outstanding."
                    : "Nothing is overdue. Here's what's due this month."}
                </span>
              </div>

              <p className="mt-4 text-[11px] font-semibold uppercase tracking-widest text-on-surface-variant">
                Pay this period · {thisPeriodLabel}
              </p>
              <p
                className={`mt-1 font-headline text-4xl md:text-5xl tabular-nums ${
                  hasPastDue ? "text-destructive" : "text-primary"
                }`}
                data-testid="portal-finances-due-now-total"
              >
                ${formatCurrency(totalDueNow)}
              </p>

              {/* breakdown: this month's dues + this month's installment */}
              <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-1 text-sm text-on-surface-variant">
                <span className="inline-flex items-center gap-2">
                  <span className="inline-block h-2.5 w-2.5 rounded-sm bg-primary" aria-hidden="true" />
                  Monthly dues{" "}
                  <b className="tabular-nums text-on-surface" data-testid="portal-finances-due-now-dues">
                    ${formatCurrency(duesDue)}
                  </b>
                </span>
                {assessmentInstallmentDue > 0 ? (
                  <span className="inline-flex items-center gap-2">
                    <span className="inline-block h-2.5 w-2.5 rounded-sm bg-primary/50" aria-hidden="true" />
                    Assessment installment{" "}
                    <b className="tabular-nums text-on-surface" data-testid="portal-finances-due-now-assessment">
                      ${formatCurrency(assessmentInstallmentDue)}
                    </b>
                  </span>
                ) : null}
              </div>

              {/* CT convenience-fee structure (memo §6) — payment-method
                  picker + disclosure. Only rendered when the association's
                  card-fee flag is on; every other association sees nothing
                  here (byte-identical to pre-existing). */}
              {totalDueNow > 0 && heroCardFeeEnabled ? (
                <div className="mt-4" data-testid="portal-finances-payment-method-picker">
                  <RadioGroup
                    value={paymentMethod}
                    onValueChange={(v) => setPaymentMethod(v === "card" ? "card" : "ach")}
                    className="flex flex-wrap gap-4"
                  >
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="ach" id="hero-pay-ach" data-testid="portal-finances-pay-method-ach" />
                      <Label htmlFor="hero-pay-ach" className="text-sm font-normal">
                        Bank transfer (ACH) — no fee
                      </Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="card" id="hero-pay-card" data-testid="portal-finances-pay-method-card" />
                      <Label htmlFor="hero-pay-card" className="text-sm font-normal">
                        Card
                        {heroFeePreview.data
                          ? ` — $${formatCurrency(heroFeePreview.data.cardFeeCents / 100)} processing fee applies`
                          : ""}
                      </Label>
                    </div>
                  </RadioGroup>
                  {paymentMethod === "card" && heroFeePreview.data ? (
                    <p className="mt-2 text-xs text-on-surface-variant" data-testid="portal-finances-fee-disclosure-hero">
                      A ${formatCurrency(heroFeePreview.data.cardFeeCents / 100)} processing fee is charged by the
                      payment platform for card payments — it is never collected by the association. Assessment $
                      {formatCurrency(totalDueNow)} + fee ${formatCurrency(heroFeePreview.data.cardFeeCents / 100)} = $
                      {formatCurrency(heroFeePreview.data.cardTotalCents / 100)} charged to your card. Pay by bank
                      transfer (ACH) to avoid it.
                    </p>
                  ) : null}
                </div>
              ) : null}

              {/* CTA — primary pays THIS period; secondary jumps to the amount box */}
              <div className="mt-5 flex flex-wrap items-center gap-3">
                {totalDueNow > 0 ? (
                  <Button
                    onClick={() => {
                      setPayError(null);
                      startCheckout.mutate({ amount: Number(heroAmountForMethod.toFixed(2)), method: paymentMethod });
                    }}
                    disabled={startCheckout.isPending}
                    className="min-h-11"
                    data-testid="portal-finances-pay-this-period-cta"
                  >
                    {startCheckout.isPending
                      ? t("portal.finances.makePayment.redirecting")
                      : `Pay $${formatCurrency(heroAmountForMethod)}${paymentMethod === "card" && heroCardFeeEnabled ? " by card" : ""}`}
                  </Button>
                ) : null}
                <a
                  href="#make-payment"
                  className="text-sm font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                  data-testid="portal-finances-pay-different"
                >
                  Pay a different amount &rarr;
                </a>
                {byUnit.length > 1 ? (
                  <span className="text-xs text-on-surface-variant">All {byUnit.length} units</span>
                ) : null}
              </div>
              {payError ? (
                <p className="mt-3 text-xs text-destructive" role="alert" data-testid="portal-finances-pay-error-hero">
                  {payError}
                </p>
              ) : null}
            </CardContent>
          </Card>
        </section>
      )}

      {/* ============ SPECIAL ASSESSMENT = PAYMENT PLAN (2026-07-09) ============
          A special assessment is paid over time in installments, so it is shown
          as a PLAN — total · paid so far · remaining "over time" · installments
          paid/total · progress · next installment — NEVER a red lump balance.
          Red appears only when an installment is genuinely past due. Driven by
          the server-computed `assessmentPlans` (reconciles: paid + remaining =
          total). */}
      {planViews.length > 0 ? (
        <section
          data-testid="portal-finances-assessment-plans"
          aria-label="Special assessment payment plans"
          className="grid gap-4"
        >
          {planViews.map(({ plan, view }) => (
            <Card
              key={plan.assessmentId}
              className={view.isPastDue ? "border-destructive/40" : "border-outline-variant/15"}
              data-testid={`portal-finances-assessment-plan-${plan.assessmentId}`}
            >
              <CardContent className="py-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-on-surface-variant">
                      Payment plan
                    </p>
                    <h2 className="font-headline text-lg text-on-surface">{plan.assessmentName}</h2>
                  </div>
                  {view.isPaidOff ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                      <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-hidden="true" />
                      Paid off
                    </span>
                  ) : view.isPastDue ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-destructive/10 px-3 py-1 text-xs font-semibold text-destructive">
                      <span className="h-1.5 w-1.5 rounded-full bg-destructive" aria-hidden="true" />
                      Past due
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" aria-hidden="true" />
                      On track
                    </span>
                  )}
                </div>

                <p className="mt-3 inline-flex items-center gap-2 rounded-lg bg-primary/[0.06] px-3 py-1.5 text-xs font-medium text-primary">
                  Paid over time in installments — not due all at once
                </p>

                {/* stat tiles: total · paid · remaining (over time) */}
                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div className="rounded-xl bg-surface-container/60 px-4 py-3">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-on-surface-variant">
                      Assessment total
                    </p>
                    <p className="mt-1 font-headline text-xl tabular-nums text-on-surface">
                      ${formatCurrency(plan.total)}
                    </p>
                  </div>
                  <div className="rounded-xl bg-surface-container/60 px-4 py-3">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-on-surface-variant">
                      Paid so far
                    </p>
                    <p className="mt-1 font-headline text-xl tabular-nums text-on-surface">
                      ${formatCurrency(plan.paidToDate)}
                    </p>
                  </div>
                  <div className="rounded-xl bg-surface-container/60 px-4 py-3">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-on-surface-variant">
                      Remaining (over time)
                    </p>
                    <p
                      className="mt-1 font-headline text-xl tabular-nums text-primary"
                      data-testid={`portal-finances-assessment-plan-${plan.assessmentId}-remaining`}
                    >
                      ${formatCurrency(plan.remaining)}
                    </p>
                  </div>
                </div>

                {/* progress bar */}
                <div className="mt-4">
                  <div className="mb-2 flex items-baseline justify-between text-sm">
                    <span className="font-semibold text-primary">{view.pctPaid}% paid</span>
                    <span className="text-on-surface-variant">
                      {/* 2026-07-12 — a legacy assessment with no real installment
                          schedule (`hasSchedule: false`) has no trustworthy
                          "N of M installments paid" count (see
                          server/portal-assessment-detail.ts). Say so plainly
                          instead of a misleading "0 of 1" / "0 installments". */}
                      {view.hasSchedule ? view.installmentsLabel : "Paid over time — no fixed installment schedule"}
                    </span>
                  </div>
                  <div
                    className="h-2.5 w-full overflow-hidden rounded-full bg-surface-container"
                    role="img"
                    aria-label={`${view.pctPaid}% of ${plan.assessmentName} paid`}
                  >
                    <div className="h-full rounded-full bg-primary" style={{ width: `${view.pctPaid}%` }} />
                  </div>
                </div>

                {/* next installment + detail link */}
                <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
                  {view.isPaidOff ? (
                    <p className="text-sm text-on-surface-variant">This assessment is fully paid.</p>
                  ) : plan.nextInstallmentAmount != null ? (
                    <p className="text-sm text-on-surface-variant">
                      Next installment:{" "}
                      <b className="tabular-nums text-on-surface">
                        ${formatCurrency(plan.nextInstallmentAmount)}
                      </b>
                      {plan.nextInstallmentDueDate ? (
                        <>
                          {" "}due{" "}
                          <b className="text-on-surface">
                            {new Date(plan.nextInstallmentDueDate).toLocaleDateString()}
                          </b>
                        </>
                      ) : null}
                      {assessmentInstallmentDue > 0 ? (
                        <span className="text-on-surface-variant"> · included in &ldquo;Pay this period&rdquo; above</span>
                      ) : null}
                    </p>
                  ) : (
                    // 2026-07-12 — no `nextInstallmentAmount` but NOT paid off:
                    // a legacy assessment with no real installment schedule
                    // (the CHC driveway assessment). Say so plainly instead of
                    // falling through to the (wrong) "fully paid" message.
                    <p className="text-sm text-on-surface-variant">
                      Paid over time — no fixed installment schedule. Contact your
                      manager for the payment schedule.
                    </p>
                  )}
                  <Link
                    href={`/portal/finances/assessments/${plan.assessmentId}`}
                    className="text-xs font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                    data-testid={`portal-finances-assessment-plan-${plan.assessmentId}-detail`}
                  >
                    View details &rarr;
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </section>
      ) : null}

      {/* ============ CONTEXT: this year + total remaining (2026-07-09) ============
          Muted, secondary context. The "Total remaining" is the full remaining
          special-assessment obligation — explicitly labeled "paid over time —
          not due now" so it can never read as an amount due today. */}
      <section className="grid gap-4 md:grid-cols-2">
        <Card className="border-outline-variant/15 bg-surface">
          <CardContent className="py-5">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-on-surface-variant">This year</p>
            <div className="mt-3 flex flex-wrap gap-x-8 gap-y-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-on-surface-variant">{t("portal.finances.cards.totalPaidYtd")}</p>
                <p className="mt-1 font-headline text-2xl tabular-nums text-on-surface">${formatCurrency(dashboard?.totalPayments ?? 0)}</p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-on-surface-variant">{t("portal.finances.cards.totalChargesYtd")}</p>
                <p className="mt-1 font-headline text-2xl tabular-nums text-on-surface">${formatCurrency(dashboard?.totalCharges ?? 0)}</p>
              </div>
            </div>
            <Link
              href="/portal/finances/ledger"
              className="mt-4 inline-flex items-center rounded text-xs font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              data-testid="portal-finances-hero-ledger-link"
            >
              <Receipt className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
              View your full ledger
            </Link>
          </CardContent>
        </Card>

        {totalRemainingOverTime > 0 ? (
          <Card className="border-outline-variant/15 bg-surface" data-testid="portal-finances-total-remaining">
            <CardContent className="py-5">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-on-surface-variant">
                Total remaining — for reference
              </p>
              <div className="mt-2 flex flex-wrap items-baseline justify-between gap-2">
                <p
                  className="font-headline text-2xl tabular-nums text-on-surface-variant"
                  data-testid="portal-finances-total-remaining-amount"
                >
                  ${formatCurrency(totalRemainingOverTime)}
                </p>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-hidden="true" />
                  Not due now
                </span>
              </div>
              <p className="mt-2 text-xs text-on-surface-variant">
                This is your remaining special-assessment balance across all units. It is{" "}
                <b className="text-on-surface">paid over time in installments</b>, not a payment due today —
                your actual amount due this period is shown at the top.
              </p>
            </CardContent>
          </Card>
        ) : null}
      </section>

      {/* 2026-06-30 — Owner PAY flow is Stripe (William finding #1). The Plaid
          "connect your bank" card was REMOVED from the owner pay experience —
          owners pay through Stripe Checkout (card + ACH on the HOA's connected
          Stripe account) via POST /api/portal/pay. Plaid stays the admin
          bank-FEED/reconciliation tool only; it is not an owner payment path. */}
      <PortalBudgetRatificationCard />
      <section className="grid gap-4 md:grid-cols-2">
        <Card data-testid="portal-finances-pay-card" id="make-payment" className="scroll-mt-24">
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
                  if (Number.isFinite(amt) && amt > 0) {
                    const chargeAmt =
                      paymentMethod === "card" && customFeePreview.data
                        ? customFeePreview.data.cardTotalCents / 100
                        : amt;
                    startCheckout.mutate({ amount: Number(chargeAmt.toFixed(2)), method: paymentMethod });
                  }
                }}
                disabled={startCheckout.isPending || !paymentAmount}
                data-testid="portal-finances-pay-now"
                className="min-h-11 w-full sm:w-auto"
              >
                {startCheckout.isPending ? t("portal.finances.makePayment.redirecting") : t("portal.finances.makePayment.cta")}
              </Button>
            </div>
            {/* CT convenience-fee structure (memo §6) — same picker pattern as
                the hero CTA above, scoped to the custom amount typed here. */}
            {customFeePreview.data?.cardFeeEnabled ? (
              <div data-testid="portal-finances-payment-method-picker-custom">
                <RadioGroup
                  value={paymentMethod}
                  onValueChange={(v) => setPaymentMethod(v === "card" ? "card" : "ach")}
                  className="flex flex-wrap gap-4"
                >
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="ach" id="custom-pay-ach" data-testid="portal-finances-pay-method-ach-custom" />
                    <Label htmlFor="custom-pay-ach" className="text-sm font-normal">
                      Bank transfer (ACH) — no fee
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="card" id="custom-pay-card" data-testid="portal-finances-pay-method-card-custom" />
                    <Label htmlFor="custom-pay-card" className="text-sm font-normal">
                      Card — ${formatCurrency(customFeePreview.data.cardFeeCents / 100)} processing fee applies
                    </Label>
                  </div>
                </RadioGroup>
                {paymentMethod === "card" ? (
                  <p className="mt-2 text-xs text-on-surface-variant" data-testid="portal-finances-fee-disclosure-custom">
                    A ${formatCurrency(customFeePreview.data.cardFeeCents / 100)} processing fee is charged by the
                    payment platform for card payments — it is never collected by the association. Total charged to
                    your card: ${formatCurrency(customFeePreview.data.cardTotalCents / 100)}. Pay by bank transfer
                    (ACH) to avoid it.
                  </p>
                ) : null}
              </div>
            ) : null}
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

      {/* 2026-07-03 — per-unit breakdown, TRANSPOSED (units = columns, line
          items = rows) and shown for EVERY owner — single-unit owners get a
          clean two-column (unit + total) table, multi-unit owners get one
          column per unit plus an "All units" total column (William ask). */}
      {perUnit.length > 0 ? (
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
                {perUnit.length > 1
                  ? `What each of your ${perUnit.length} units owes — HOA dues and special assessments shown separately.`
                  : "HOA dues and special assessments for your unit, shown separately."}
              </p>
            </div>
            <p
              className="font-headline text-xl text-on-surface tabular-nums"
              data-testid="portal-finances-by-unit-grand-total"
            >
              ${formatCurrency(dashboard?.grandTotal ?? balance)}
            </p>
          </div>
          <PerUnitTransposedTable
            units={perUnit}
            hasUpcomingInstallments={upcoming.length > 0}
          />
        </section>
      ) : null}

      {/* 2026-07-09 — the standalone "Upcoming installments" link list was
          folded INTO the per-assessment payment-plan cards above (each plan
          card shows its next installment + a "View details" link), so this
          redundant section was removed to keep the page calm and scannable. */}

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
      // A non-array body (error object, auth shell) must not crash the saved-methods list (#380).
      const json = await res.json();
      return Array.isArray(json) ? (json as PaymentMethod[]) : [];
    },
  });

  const { data: enrollments = [] } = useQuery<AutopayEnrollment[]>({
    queryKey: ["portal/autopay/enrollments", session.id],
    queryFn: async () => {
      const res = await portalFetch("/api/portal/autopay/enrollments");
      if (!res.ok) return [];
      // A non-array body (error object, auth shell) must not crash the autopay list (#380).
      const json = await res.json();
      return Array.isArray(json) ? (json as AutopayEnrollment[]) : [];
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
      // A non-array `receipts` (error object, auth shell) must not crash the receipts list (#380).
      const json = (await res.json()) as { receipts?: ReceiptSummary[] };
      return { receipts: Array.isArray(json?.receipts) ? json.receipts : [] };
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
      ) : !data?.receipts?.length ? (
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
