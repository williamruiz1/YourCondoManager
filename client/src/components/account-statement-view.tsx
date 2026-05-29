// Shared owner account-statement view (readiness P0-3 / Issue #206).
//
// Print-friendly rendering of the structured statement returned by
// GET /api/portal/statement and GET /api/financial/owner-ledger/statement.
// Used by BOTH the owner portal (own statement) and the admin/treasurer
// surface (any owner). The "Print / Save as PDF" button triggers the browser
// print dialog; the print-CSS below collapses chrome to a clean document.
//
// v1 deliberately uses print-CSS (window.print → Save as PDF) per the spec's
// "print-CSS acceptable for v1" acceptance line — no server-side PDF renderer.

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Printer } from "lucide-react";

// Client-side mirror of the server's AccountStatementWithHeader shape. Kept in
// sync with server/services/account-statement.ts — both surfaces consume the
// same JSON.
export interface AccountStatementResponse {
  associationId: string;
  personId: string;
  unitId: string | null;
  periodStart: string;
  periodEnd: string;
  openingBalance: number;
  closingBalance: number;
  periodNetChange: number;
  categoryTotals: {
    charges: number;
    assessments: number;
    lateFees: number;
    payments: number;
    credits: number;
    adjustments: number;
  };
  lineItems: Array<{
    id: string;
    entryType: string;
    amount: number;
    postedAt: string;
    description: string | null;
  }>;
  header: {
    associationName: string | null;
    ownerName: string | null;
    ownerEmail: string | null;
    unitNumber: string | null;
    building: string | null;
  };
}

function money(n: number): string {
  const abs = Math.abs(n);
  const formatted = abs.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  // Parenthesize negatives (credit balances / money out) per accounting style.
  return n < 0 ? `($${formatted})` : `$${formatted}`;
}

function fmtDate(iso: string): string {
  // Render the date portion only (statements are day-granular).
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

const CATEGORY_ROWS: Array<{
  key: keyof AccountStatementResponse["categoryTotals"];
  label: string;
}> = [
  { key: "assessments", label: "Assessments" },
  { key: "charges", label: "HOA dues / charges" },
  { key: "lateFees", label: "Late fees" },
  { key: "payments", label: "Payments" },
  { key: "credits", label: "Credits" },
  { key: "adjustments", label: "Adjustments" },
];

export function AccountStatementView({
  statement,
  showPrint = true,
}: {
  statement: AccountStatementResponse;
  showPrint?: boolean;
}) {
  const { header, categoryTotals } = statement;
  const unitLabel = header.unitNumber
    ? header.building
      ? `${header.building} · Unit ${header.unitNumber}`
      : `Unit ${header.unitNumber}`
    : statement.unitId
      ? "Selected unit"
      : "All units";

  return (
    <div data-testid="account-statement-view" className="account-statement">
      {/* Print-only stylesheet — collapses app chrome and forces a clean
          single-document layout when the browser print dialog runs. Scoped to
          .account-statement so it doesn't leak into other print flows. */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .account-statement, .account-statement * { visibility: visible; }
          .account-statement { position: absolute; left: 0; top: 0; width: 100%; padding: 24px; }
          .account-statement .no-print { display: none !important; }
          .account-statement table { width: 100%; border-collapse: collapse; }
        }
      `}</style>

      {showPrint ? (
        <div className="no-print mb-4 flex justify-end">
          <Button
            variant="outline"
            onClick={() => window.print()}
            data-testid="account-statement-print"
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
            <h2 className="font-headline text-2xl" data-testid="account-statement-title">
              Account Statement
            </h2>
            <p className="text-sm text-on-surface-variant">
              {header.associationName ?? "Association"}
            </p>
            <div className="mt-2 grid grid-cols-1 gap-1 text-sm sm:grid-cols-2">
              <p>
                <span className="text-on-surface-variant">Owner: </span>
                <span data-testid="account-statement-owner">{header.ownerName ?? "—"}</span>
              </p>
              <p>
                <span className="text-on-surface-variant">Unit: </span>
                <span data-testid="account-statement-unit">{unitLabel}</span>
              </p>
              <p>
                <span className="text-on-surface-variant">Period: </span>
                <span data-testid="account-statement-period">
                  {fmtDate(statement.periodStart)} – {fmtDate(statement.periodEnd)}
                </span>
              </p>
              {header.ownerEmail ? (
                <p>
                  <span className="text-on-surface-variant">Email: </span>
                  {header.ownerEmail}
                </p>
              ) : null}
            </div>
          </header>

          {/* Balance summary */}
          <section
            className="grid grid-cols-1 gap-3 sm:grid-cols-3"
            data-testid="account-statement-balances"
          >
            <div className="rounded-lg border border-outline-variant/15 p-4">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-on-surface-variant">
                Opening balance
              </p>
              <p
                className="mt-1 font-headline text-2xl tabular-nums"
                data-testid="account-statement-opening"
              >
                {money(statement.openingBalance)}
              </p>
            </div>
            <div className="rounded-lg border border-outline-variant/15 p-4">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-on-surface-variant">
                Net change this period
              </p>
              <p
                className="mt-1 font-headline text-2xl tabular-nums"
                data-testid="account-statement-net"
              >
                {money(statement.periodNetChange)}
              </p>
            </div>
            <div className="rounded-lg border border-primary/30 bg-primary/[0.04] p-4">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-primary">
                Closing balance
              </p>
              <p
                className={`mt-1 font-headline text-2xl tabular-nums ${
                  statement.closingBalance > 0 ? "text-destructive" : "text-on-surface"
                }`}
                data-testid="account-statement-closing"
              >
                {money(statement.closingBalance)}
              </p>
            </div>
          </section>

          {/* Category roll-up */}
          <section data-testid="account-statement-categories">
            <h3 className="mb-2 font-headline text-lg">This period by category</h3>
            <ul className="grid grid-cols-1 gap-x-8 gap-y-1 sm:grid-cols-2">
              {CATEGORY_ROWS.map(({ key, label }) => (
                <li
                  key={key}
                  className="flex items-center justify-between border-b border-outline-variant/10 py-1 text-sm"
                  data-testid={`account-statement-category-${key}`}
                >
                  <span className="text-on-surface-variant">{label}</span>
                  <span className="font-medium tabular-nums">
                    {money(categoryTotals[key])}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          {/* Line items */}
          <section data-testid="account-statement-lineitems">
            <h3 className="mb-2 font-headline text-lg">Activity detail</h3>
            {statement.lineItems.length === 0 ? (
              <p
                className="py-4 text-sm text-on-surface-variant"
                data-testid="account-statement-empty"
              >
                No activity in this period.
              </p>
            ) : (
              <Table aria-label="Statement activity detail">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-28">Date</TableHead>
                    <TableHead className="w-32">Type</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="w-28 text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {statement.lineItems.map((item) => (
                    <TableRow key={item.id} data-testid={`account-statement-row-${item.id}`}>
                      <TableCell className="text-xs">{fmtDate(item.postedAt)}</TableCell>
                      <TableCell className="text-xs">
                        <Badge variant="outline" className="capitalize">
                          {item.entryType.replace(/-/g, " ")}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs">{item.description ?? "—"}</TableCell>
                      <TableCell className="text-right text-xs tabular-nums">
                        {money(item.amount)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </section>

          <p className="text-xs text-on-surface-variant">
            Closing balance = opening balance + net change this period. A balance
            in parentheses is a credit (the association owes the owner).
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
