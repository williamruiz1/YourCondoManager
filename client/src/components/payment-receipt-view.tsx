/**
 * Payment Receipt View (P0-2 — Issue #205)
 *
 * Printable/downloadable receipt for a single settled payment.
 * Follows the print-CSS pattern from account-statement-view.tsx.
 */

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Printer } from "lucide-react";

// Client-side mirror of server/services/payment-receipt-email.ts PaymentReceiptContext
export interface PaymentReceiptData {
  receiptReference: string;
  amountCents: number;
  amountFormatted: string;
  confirmedAt: string;
  paidAtFormatted: string;
  description: string;
  recipientName: string;
  recipientEmail: string;
  associationName: string;
  unitLabel: string;
  balanceAfterCents: number;
  balanceAfterFormatted: string;
}

export function PaymentReceiptView({
  receipt,
  showPrint = true,
}: {
  receipt: PaymentReceiptData;
  showPrint?: boolean;
}) {
  return (
    <div data-testid="payment-receipt-view" className="payment-receipt">
      {/* Print-only stylesheet — same pattern as account-statement-view */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .payment-receipt, .payment-receipt * { visibility: visible; }
          .payment-receipt { position: absolute; left: 0; top: 0; width: 100%; padding: 24px; }
          .payment-receipt .no-print { display: none !important; }
        }
      `}</style>

      {showPrint ? (
        <div className="no-print mb-4 flex justify-end">
          <Button
            variant="outline"
            onClick={() => window.print()}
            data-testid="payment-receipt-print"
          >
            <Printer className="mr-2 h-4 w-4" aria-hidden="true" />
            Print / Save as PDF
          </Button>
        </div>
      ) : null}

      <Card>
        <CardContent className="space-y-6 py-6">
          {/* Header */}
          <header className="flex flex-col gap-1 border-b border-outline-variant/15 pb-4">
            <h2
              className="font-headline text-2xl"
              data-testid="payment-receipt-title"
            >
              Payment Receipt
            </h2>
            <p className="text-sm text-on-surface-variant">
              {receipt.associationName}
            </p>
            <div className="mt-2 grid grid-cols-1 gap-1 text-sm sm:grid-cols-2">
              <p>
                <span className="text-on-surface-variant">Owner: </span>
                <span data-testid="payment-receipt-owner">
                  {receipt.recipientName}
                </span>
              </p>
              <p>
                <span className="text-on-surface-variant">Unit: </span>
                <span data-testid="payment-receipt-unit">
                  {receipt.unitLabel}
                </span>
              </p>
              <p>
                <span className="text-on-surface-variant">Email: </span>
                {receipt.recipientEmail}
              </p>
              <p>
                <span className="text-on-surface-variant">Paid: </span>
                <span data-testid="payment-receipt-date">
                  {receipt.paidAtFormatted}
                </span>
              </p>
            </div>
          </header>

          {/* Amount + receipt number */}
          <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-primary/30 bg-primary/[0.04] p-4">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-on-surface-variant">
                Amount paid
              </p>
              <p
                className="mt-1 font-headline text-3xl tabular-nums"
                data-testid="payment-receipt-amount"
              >
                {receipt.amountFormatted}
              </p>
            </div>
            <div className="rounded-lg border border-outline-variant/15 p-4">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-on-surface-variant">
                Balance after payment
              </p>
              <p
                className="mt-1 font-headline text-3xl tabular-nums"
                data-testid="payment-receipt-balance"
              >
                {receipt.balanceAfterFormatted}
              </p>
            </div>
          </section>

          {/* Detail rows */}
          <section>
            <table className="w-full text-sm">
              <tbody>
                <tr className="border-b border-outline-variant/15">
                  <td className="py-2 text-on-surface-variant">Description</td>
                  <td
                    className="py-2 text-right"
                    data-testid="payment-receipt-description"
                  >
                    {receipt.description}
                  </td>
                </tr>
                <tr className="border-b border-outline-variant/15">
                  <td className="py-2 text-on-surface-variant">Receipt #</td>
                  <td
                    className="py-2 text-right font-mono text-xs"
                    data-testid="payment-receipt-reference"
                  >
                    {receipt.receiptReference}
                  </td>
                </tr>
                <tr>
                  <td className="py-2 text-on-surface-variant">Date</td>
                  <td className="py-2 text-right">{receipt.paidAtFormatted}</td>
                </tr>
              </tbody>
            </table>
          </section>

          <p className="text-xs text-on-surface-variant">
            Keep this receipt for your records. ACH payments may take 3–5
            business days to fully settle on your bank statement.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
