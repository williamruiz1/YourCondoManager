/**
 * 4.3 Q5 — Owner-portal assessment detail drill-in.
 *
 * Modal-based surface that mirrors the route-spec for
 * `/portal/assessments/:assessmentId` (Wave 9 implementation choice — the
 * portal currently only has two top-level routes, so a modal/drawer
 * provides the drill-in without wiring a new route). Renders the nine
 * required fields from 4.3 Q5 AC:
 *
 *   label, total principal, interest rate, term, allocation method,
 *   owner portion, payment options, total interest, history.
 *
 * Payment options are read-only here (Manager-managed).
 *
 * Spec anchor:
 *   docs/projects/platform-overhaul/decisions/4.3-recurring-assessment-rules-engine.md
 */

import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

export type PortalAssessmentDetailResponse = {
  assessment: {
    id: string;
    name: string;
    totalAmount: number;
    startDate: string;
    endDate: string | null;
    installmentCount: number;
    interestRatePercent: number | null;
    termMonths: number | null;
    allocationMethod: string;
    paymentOptions: {
      lumpSumAllowed: boolean;
      lumpSumDiscountPercent: number | null;
      customInstallmentPlansAllowed: boolean;
    } | null;
  };
  ownerPortion: {
    principal: number;
    interest: number;
    total: number;
    installmentAmount: number;
    remainingInstallments: number;
    allocationReason: string;
  };
  history: {
    installmentsPosted: number;
    totalPaid: number;
    totalOwed: number;
    ledgerEntries: Array<{
      id: string;
      postedAt: string;
      amount: number;
      balance: number;
    }>;
  };
};

function fmtMoney(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  return `$${n.toFixed(2)}`;
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString();
  } catch {
    return "—";
  }
}

function fmtPercent(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  return `${n.toFixed(2)}%`;
}

function fmtAllocationMethodLabel(method: string): string {
  switch (method) {
    case "per-unit-equal":
      return "Per unit (equal split)";
    case "per-sq-ft":
      return "Per square foot";
    case "per-ownership-share":
      return "Per ownership share";
    case "custom":
      return "Custom allocation";
    default:
      return method;
  }
}

type PortalFetch = (url: string, options?: RequestInit) => Promise<Response>;

export type PortalAssessmentDetailDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assessmentId: string | null;
  portalFetch: PortalFetch;
};

export function PortalAssessmentDetailDialog(props: PortalAssessmentDetailDialogProps) {
  const { open, onOpenChange, assessmentId, portalFetch } = props;
  const { data, isLoading, isError, error } = useQuery<PortalAssessmentDetailResponse>({
    queryKey: ["portal/assessment-detail", assessmentId],
    enabled: !!assessmentId && open,
    queryFn: async () => {
      const res = await portalFetch(`/api/portal/assessments/${assessmentId}/detail`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({ message: "Failed to load assessment" }));
        throw new Error(body?.message ?? `HTTP ${res.status}`);
      }
      return res.json();
    },
    retry: false,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-3xl max-h-[90vh] overflow-y-auto"
        data-testid="portal-assessment-detail-dialog"
      >
        <DialogHeader>
          <DialogTitle data-testid="portal-assessment-detail-title">
            {data ? `${data.assessment.name} — Assessment — My Portal` : "Assessment — My Portal"}
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="py-12 text-center text-sm text-on-surface-variant" data-testid="portal-assessment-detail-loading">
            Loading assessment detail…
          </div>
        ) : isError ? (
          <div className="py-8 text-center" data-testid="portal-assessment-detail-error">
            <p className="text-sm text-destructive">
              {(error as Error)?.message || "Unable to load this assessment."}
            </p>
          </div>
        ) : data ? (
          <PortalAssessmentDetailBody data={data} />
        ) : null}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Body — rendered as its own component so tests can import + render the
// loaded state without mocking useQuery.
// ---------------------------------------------------------------------------

export function PortalAssessmentDetailBody({ data }: { data: PortalAssessmentDetailResponse }) {
  const { assessment, ownerPortion, history } = data;

  return (
    <div className="space-y-6">
      {/* 9 required fields per 4.3 Q5 AC:
            label, total principal, interest rate, term,
            allocation method, owner portion, payment options,
            total interest, history. */}
      <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2" data-testid="portal-assessment-detail-fields">
        <Field label="Label" testId="field-label">
          {assessment.name}
        </Field>
        <Field label="Total principal" testId="field-total-principal">
          {fmtMoney(assessment.totalAmount)}
        </Field>
        <Field label="Interest rate" testId="field-interest-rate">
          {fmtPercent(assessment.interestRatePercent)}
        </Field>
        <Field label="Term" testId="field-term">
          {assessment.termMonths != null ? `${assessment.termMonths} months` : "—"}
        </Field>
        <Field label="Allocation method" testId="field-allocation-method">
          <span>{fmtAllocationMethodLabel(assessment.allocationMethod)}</span>
          {ownerPortion.allocationReason &&
            ownerPortion.allocationReason !== assessment.allocationMethod && (
              <span className="block text-xs text-on-surface-variant mt-1" data-testid="field-allocation-reason">
                {ownerPortion.allocationReason}
              </span>
            )}
        </Field>
        <Field label="Your portion" testId="field-owner-portion">
          {fmtMoney(ownerPortion.total)}
          <span className="block text-xs text-on-surface-variant mt-1">
            {fmtMoney(ownerPortion.installmentAmount)} × {assessment.installmentCount} installments
          </span>
        </Field>
        <Field label="Total interest" testId="field-total-interest">
          {fmtMoney(ownerPortion.interest)}
        </Field>
        <Field label="Payment options" testId="field-payment-options">
          <PaymentOptionsView options={assessment.paymentOptions} />
        </Field>
      </dl>

      <section
        className="border border-outline-variant/10 rounded-xl p-4 bg-surface-container-lowest"
        data-testid="portal-assessment-detail-history"
      >
        <h3 className="text-sm font-bold mb-3">History</h3>
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div>
            <p className="text-xs text-on-surface-variant">Installments posted</p>
            <p className="font-bold" data-testid="history-installments-posted">
              {history.installmentsPosted} of {assessment.installmentCount}
            </p>
          </div>
          <div>
            <p className="text-xs text-on-surface-variant">Total paid</p>
            <p className="font-bold">{fmtMoney(history.totalPaid)}</p>
          </div>
          <div>
            <p className="text-xs text-on-surface-variant">Total owed</p>
            <p className="font-bold">{fmtMoney(history.totalOwed)}</p>
          </div>
        </div>
        {history.ledgerEntries.length === 0 ? (
          <p className="text-xs text-on-surface-variant" data-testid="history-empty">
            No installments posted yet.
          </p>
        ) : (
          <table className="w-full text-sm" data-testid="history-table">
            <thead>
              <tr className="text-left text-xs text-on-surface-variant">
                <th className="py-1 pr-3">Date</th>
                <th className="py-1 pr-3">Amount</th>
                <th className="py-1 pr-3">Balance</th>
              </tr>
            </thead>
            <tbody>
              {history.ledgerEntries.map((entry) => (
                <tr key={entry.id} data-testid={`history-row-${entry.id}`}>
                  <td className="py-1 pr-3">{fmtDate(entry.postedAt)}</td>
                  <td className="py-1 pr-3">{fmtMoney(entry.amount)}</td>
                  <td className="py-1 pr-3">{fmtMoney(entry.balance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

function Field({
  label,
  children,
  testId,
}: {
  label: string;
  children: React.ReactNode;
  testId: string;
}) {
  return (
    <div data-testid={testId}>
      <dt className="text-xs text-on-surface-variant uppercase tracking-widest">{label}</dt>
      <dd className="mt-1 text-sm text-on-surface">{children}</dd>
    </div>
  );
}

function PaymentOptionsView({
  options,
}: {
  options: PortalAssessmentDetailResponse["assessment"]["paymentOptions"];
}) {
  if (!options) {
    return <span className="text-sm text-on-surface-variant">Installment plan only</span>;
  }
  const parts: string[] = [];
  if (options.lumpSumAllowed) {
    const pct = options.lumpSumDiscountPercent;
    parts.push(
      pct && pct > 0
        ? `Lump-sum payoff allowed (${pct.toFixed(2)}% discount)`
        : "Lump-sum payoff allowed",
    );
  }
  if (options.customInstallmentPlansAllowed) {
    parts.push("Custom installment plan available");
  }
  if (parts.length === 0) {
    return <span className="text-sm text-on-surface-variant">Installment plan only</span>;
  }
  return (
    <ul className="list-disc list-inside text-sm">
      {parts.map((p) => (
        <li key={p}>{p}</li>
      ))}
    </ul>
  );
}
