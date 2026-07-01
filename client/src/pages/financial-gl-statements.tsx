// zone: Financials
// persona: Manager, Board Officer, Assisted Board, PM Assistant, Treasurer, Viewer
//
// YCM Financial Core — Phase 3: trustworthy GL-derived financial statements.
//
// The page an owner/board member looks at to "confidently say what belongs to
// what." It renders, from the fund-aware double-entry GL (READ-ONLY, DERIVED):
//   • a reconcile-to-the-cent TRUST banner (does the GL tie out to the live
//     owner ledger, do the double-entry invariants hold, does the sheet balance),
//   • an INCOME & EXPENSE statement (income by account, expense by account, net),
//   • a BALANCE SHEET (assets = liabilities + equity/fund balance, by fund),
//   • a BUDGET-VS-ACTUAL report (variance by category, by fund).
//
// GATED behind GL_ENABLED / GL_ENABLED_ASSOCIATIONS: the statements API returns
// 404 when the GL is off for the association, and this page renders a plain
// "not enabled yet" state instead of an error. These figures are DERIVED — the
// owner ledger stays the system of record; nothing here writes any table.
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useActiveAssociation } from "@/hooks/use-active-association";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { WorkspacePageHeader } from "@/components/workspace-page-header";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { financeSubPages } from "@/lib/sub-page-nav";
import { CheckCircle2, AlertTriangle, Info } from "lucide-react";
import { cn } from "@/lib/utils";

// ── DERIVED statement shapes (mirror server/services/gl/statements* payloads) ──

type Fund = "operating" | "reserve";

interface StatementLine {
  accountCode: string;
  name: string;
  fund: Fund;
  accountType: string;
  balanceCents: number;
}

interface IncomeStatementFundSection {
  fund: Fund;
  income: StatementLine[];
  expenses: StatementLine[];
  totalIncomeCents: number;
  totalExpenseCents: number;
  netIncomeCents: number;
}

interface IncomeStatement {
  funds: IncomeStatementFundSection[];
  totalIncomeCents: number;
  totalExpenseCents: number;
  netIncomeCents: number;
}

interface BalanceSheetFundSection {
  fund: Fund;
  assets: StatementLine[];
  liabilities: StatementLine[];
  equity: StatementLine[];
  totalAssetsCents: number;
  totalLiabilitiesCents: number;
  totalEquityCents: number;
  netIncomeCents: number;
}

interface BalanceSheet {
  funds: BalanceSheetFundSection[];
  totalAssetsCents: number;
  totalLiabilitiesCents: number;
  totalEquityCents: number;
  differenceCents: number;
  balanced: boolean;
}

interface BudgetVsActualLine {
  categoryName: string;
  fund: Fund;
  budgetedCents: number;
  actualCents: number;
  varianceCents: number;
  variancePct: number | null;
  overBudget: boolean;
}

interface BudgetVsActualFundSection {
  fund: Fund;
  lines: BudgetVsActualLine[];
  totalBudgetedCents: number;
  totalActualCents: number;
  totalVarianceCents: number;
}

interface BudgetVsActualReport {
  funds: BudgetVsActualFundSection[];
  totalBudgetedCents: number;
  totalActualCents: number;
  totalVarianceCents: number;
}

interface StatementsReconciliation {
  ownerLedgerBalanceCents: number;
  glAccountsReceivableCents: number;
  arDifferenceCents: number;
  ownerLedgerTiesOut: boolean;
  invariantViolations: string[];
  balanceSheetBalanced: boolean;
  balanceSheetDifferenceCents: number;
  trustworthy: boolean;
}

interface FinancialStatements {
  associationId: string;
  generatedAt: string;
  derived: true;
  balanceSheet: BalanceSheet;
  incomeStatement: IncomeStatement;
  budgetVsActual: BudgetVsActualReport;
  reconciliation: StatementsReconciliation;
}

// A sentinel the query returns when the GL is OFF for this association (404).
const GL_OFF = { glOff: true } as const;
type StatementsResult = FinancialStatements | typeof GL_OFF;

function isGlOff(r: StatementsResult | undefined): r is typeof GL_OFF {
  return !!r && "glOff" in r;
}

// ── Formatting ────────────────────────────────────────────────────────────────

function fmtDollars(cents: number): string {
  const negative = cents < 0;
  const abs = Math.abs(cents) / 100;
  const s = abs.toLocaleString("en-US", { style: "currency", currency: "USD" });
  return negative ? `(${s})` : s;
}

function fundLabel(fund: Fund): string {
  return fund === "reserve" ? "Reserve Fund" : "Operating Fund";
}

// ── Page ────────────────────────────────────────────────────────────────────

export default function FinancialGlStatementsPage() {
  useDocumentTitle("Financial Statements");
  const { activeAssociationId } = useActiveAssociation();

  const { data, isLoading, error } = useQuery<StatementsResult>({
    queryKey: ["/api/financial/statements", activeAssociationId],
    enabled: !!activeAssociationId,
    queryFn: async () => {
      try {
        const res = await apiRequest(
          "GET",
          `/api/financial/statements?associationId=${activeAssociationId}`,
        );
        return (await res.json()) as FinancialStatements;
      } catch (e: any) {
        // The API 404s when the GL is off for this association — a normal state,
        // not an error. Surface the "not enabled" UI rather than an error toast.
        if (typeof e?.message === "string" && e.message.startsWith("404")) return GL_OFF;
        throw e;
      }
    },
  });

  return (
    <div className="flex flex-col min-h-0">
      <div className="p-6 space-y-6">
        <WorkspacePageHeader
          title="Financial Statements"
          summary="Trustworthy income & expense, balance sheet, and budget-vs-actual — built from the double-entry general ledger and reconciled to the cent."
          eyebrow="Finance"
          breadcrumbs={[{ label: "Financials", href: "/app/financials" }, { label: "Statements" }]}
          subPages={financeSubPages}
        />

        {!activeAssociationId && (
          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>Select an association</AlertTitle>
            <AlertDescription>
              Choose an association to view its financial statements.
            </AlertDescription>
          </Alert>
        )}

        {activeAssociationId && isLoading && <StatementsSkeleton />}

        {activeAssociationId && !isLoading && isGlOff(data) && <GlOffState />}

        {activeAssociationId && !isLoading && error && !isGlOff(data) && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Couldn't load statements</AlertTitle>
            <AlertDescription>{(error as Error).message}</AlertDescription>
          </Alert>
        )}

        {activeAssociationId && !isLoading && data && !isGlOff(data) && (
          <StatementsView statements={data} />
        )}
      </div>
    </div>
  );
}

function StatementsSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}

function GlOffState() {
  return (
    <Alert>
      <Info className="h-4 w-4" />
      <AlertTitle>Financial statements are not enabled yet</AlertTitle>
      <AlertDescription>
        The double-entry general ledger for this association hasn't been turned on
        yet. Once enabled, this page shows an income &amp; expense statement, a
        balance sheet, and a budget-vs-actual report — all reconciled to the cent
        against the live owner ledger.
      </AlertDescription>
    </Alert>
  );
}

// ── The assembled view ────────────────────────────────────────────────────────

function StatementsView({ statements }: { statements: FinancialStatements }) {
  const { reconciliation: rec } = statements;
  return (
    <div className="space-y-6">
      <TrustBanner rec={rec} />

      <p className="text-xs text-muted-foreground">
        These figures are <strong>derived</strong> from the general ledger for
        reporting. The owner ledger remains the system of record. Generated{" "}
        {new Date(statements.generatedAt).toLocaleString()}.
      </p>

      <Tabs defaultValue="income" className="space-y-6">
        <TabsList>
          <TabsTrigger value="income" data-testid="tab-income-statement">
            Income &amp; Expense
          </TabsTrigger>
          <TabsTrigger value="balance-sheet" data-testid="tab-balance-sheet">
            Balance Sheet
          </TabsTrigger>
          <TabsTrigger value="budget" data-testid="tab-budget-vs-actual">
            Budget vs Actual
          </TabsTrigger>
        </TabsList>

        <TabsContent value="income" className="mt-0">
          <IncomeStatementView statement={statements.incomeStatement} />
        </TabsContent>
        <TabsContent value="balance-sheet" className="mt-0">
          <BalanceSheetView sheet={statements.balanceSheet} />
        </TabsContent>
        <TabsContent value="budget" className="mt-0">
          <BudgetVsActualView report={statements.budgetVsActual} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ── Trust banner (the reconcile-to-cent indicator) ────────────────────────────

function TrustBanner({ rec }: { rec: StatementsReconciliation }) {
  if (rec.trustworthy) {
    return (
      <Card className="border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/30">
        <CardContent className="flex items-start gap-3 py-4">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <div className="space-y-1">
            <p className="font-semibold text-emerald-800 dark:text-emerald-300">
              Ties out to the cent
            </p>
            <p className="text-sm text-emerald-700/90 dark:text-emerald-300/80">
              The general ledger matches the live owner ledger exactly, every
              journal entry balances (debits = credits), and the balance sheet
              balances (assets = liabilities + equity). These numbers can be
              trusted.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-amber-300 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30">
      <CardContent className="space-y-2 py-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
          <div className="space-y-1">
            <p className="font-semibold text-amber-800 dark:text-amber-300">
              Does not fully tie out — review before relying on these figures
            </p>
            <ul className="mt-1 space-y-1 text-sm text-amber-700/90 dark:text-amber-300/80">
              {!rec.ownerLedgerTiesOut && (
                <li>
                  General ledger vs owner ledger differ by{" "}
                  <strong>{fmtDollars(Math.abs(rec.arDifferenceCents))}</strong>{" "}
                  (ledger {fmtDollars(rec.ownerLedgerBalanceCents)} vs GL AR{" "}
                  {fmtDollars(rec.glAccountsReceivableCents)}).
                </li>
              )}
              {!rec.balanceSheetBalanced && (
                <li>
                  Balance sheet is off by{" "}
                  <strong>{fmtDollars(Math.abs(rec.balanceSheetDifferenceCents))}</strong>{" "}
                  (assets ≠ liabilities + equity).
                </li>
              )}
              {rec.invariantViolations.map((v, i) => (
                <li key={i}>Double-entry issue: {v}</li>
              ))}
            </ul>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Income & Expense statement ────────────────────────────────────────────────

function IncomeStatementView({ statement }: { statement: IncomeStatement }) {
  if (statement.funds.length === 0) {
    return <EmptyStatement label="No income or expense activity in the ledger yet." />;
  }
  return (
    <div className="space-y-6">
      {statement.funds.map((section) => (
        <Card key={section.fund}>
          <CardHeader>
            <CardTitle className="text-base">{fundLabel(section.fund)}</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Account</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <SectionHeaderRow label="Income" />
                {section.income.length === 0 && <MutedRow label="No income posted" />}
                {section.income.map((l) => (
                  <AmountRow key={`${l.accountCode}-${l.fund}`} name={`${l.accountCode} · ${l.name}`} cents={l.balanceCents} />
                ))}
                <TotalRow label="Total income" cents={section.totalIncomeCents} />

                <SectionHeaderRow label="Expenses" />
                {section.expenses.length === 0 && <MutedRow label="No expenses posted" />}
                {section.expenses.map((l) => (
                  <AmountRow key={`${l.accountCode}-${l.fund}`} name={`${l.accountCode} · ${l.name}`} cents={l.balanceCents} />
                ))}
                <TotalRow label="Total expenses" cents={section.totalExpenseCents} />

                <NetRow label="Net (surplus / deficit)" cents={section.netIncomeCents} />
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ))}

      <Card className="border-primary/30">
        <CardContent className="flex items-center justify-between py-4">
          <span className="font-semibold">Net income — all funds</span>
          <span
            className={cn(
              "font-mono font-semibold",
              statement.netIncomeCents < 0 ? "text-destructive" : "text-emerald-600 dark:text-emerald-400",
            )}
            data-testid="income-statement-net"
          >
            {fmtDollars(statement.netIncomeCents)}
          </span>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Balance sheet ─────────────────────────────────────────────────────────────

function BalanceSheetView({ sheet }: { sheet: BalanceSheet }) {
  if (sheet.funds.every((f) => f.assets.length + f.liabilities.length + f.equity.length === 0)) {
    return <EmptyStatement label="No balance-sheet activity in the ledger yet." />;
  }
  return (
    <div className="space-y-6">
      {sheet.funds.map((section) => {
        const empty =
          section.assets.length + section.liabilities.length + section.equity.length === 0;
        if (empty) return null;
        return (
          <Card key={section.fund}>
            <CardHeader>
              <CardTitle className="text-base">{fundLabel(section.fund)}</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Account</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <SectionHeaderRow label="Assets" />
                  {section.assets.map((l) => (
                    <AmountRow key={`${l.accountCode}-${l.fund}`} name={`${l.accountCode} · ${l.name}`} cents={l.balanceCents} />
                  ))}
                  <TotalRow label="Total assets" cents={section.totalAssetsCents} />

                  <SectionHeaderRow label="Liabilities" />
                  {section.liabilities.length === 0 && <MutedRow label="None" />}
                  {section.liabilities.map((l) => (
                    <AmountRow key={`${l.accountCode}-${l.fund}`} name={`${l.accountCode} · ${l.name}`} cents={l.balanceCents} />
                  ))}
                  <TotalRow label="Total liabilities" cents={section.totalLiabilitiesCents} />

                  <SectionHeaderRow label="Equity / Fund Balance" />
                  {section.equity.map((l) => (
                    <AmountRow key={`${l.accountCode}-${l.fund}`} name={`${l.accountCode} · ${l.name}`} cents={l.balanceCents} />
                  ))}
                  <TotalRow label="Total equity" cents={section.totalEquityCents} />
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        );
      })}

      <Card className={cn("border", sheet.balanced ? "border-emerald-300" : "border-amber-300")}>
        <CardContent className="space-y-1 py-4">
          <div className="flex items-center justify-between">
            <span className="font-semibold">Total assets</span>
            <span className="font-mono">{fmtDollars(sheet.totalAssetsCents)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="font-semibold">Total liabilities + equity</span>
            <span className="font-mono">
              {fmtDollars(sheet.totalLiabilitiesCents + sheet.totalEquityCents)}
            </span>
          </div>
          <div className="flex items-center justify-between pt-1 text-sm">
            <span className="text-muted-foreground">Difference (must be $0.00)</span>
            <Badge variant={sheet.balanced ? "default" : "destructive"} data-testid="balance-sheet-difference">
              {fmtDollars(sheet.differenceCents)}
            </Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Budget vs actual ──────────────────────────────────────────────────────────

function BudgetVsActualView({ report }: { report: BudgetVsActualReport }) {
  if (report.funds.length === 0) {
    return <EmptyStatement label="No budget or actual activity to compare yet." />;
  }
  return (
    <div className="space-y-6">
      {report.funds.map((section) => (
        <Card key={section.fund}>
          <CardHeader>
            <CardTitle className="text-base">{fundLabel(section.fund)}</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Budget</TableHead>
                  <TableHead className="text-right">Actual</TableHead>
                  <TableHead className="text-right">Variance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {section.lines.map((l) => (
                  <TableRow key={`${l.categoryName}-${l.fund}`}>
                    <TableCell>
                      {l.categoryName}
                      {l.budgetedCents === 0 && (
                        <Badge variant="outline" className="ml-2 text-amber-600">
                          Unbudgeted
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-mono">{fmtDollars(l.budgetedCents)}</TableCell>
                    <TableCell className="text-right font-mono">{fmtDollars(l.actualCents)}</TableCell>
                    <TableCell
                      className={cn(
                        "text-right font-mono",
                        l.overBudget ? "text-destructive" : "text-muted-foreground",
                      )}
                    >
                      {fmtDollars(l.varianceCents)}
                      {l.variancePct !== null && (
                        <span className="ml-1 text-xs">
                          ({l.variancePct >= 0 ? "+" : ""}
                          {(l.variancePct * 100).toFixed(1)}%)
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow className="font-semibold">
                  <TableCell>Total</TableCell>
                  <TableCell className="text-right font-mono">{fmtDollars(section.totalBudgetedCents)}</TableCell>
                  <TableCell className="text-right font-mono">{fmtDollars(section.totalActualCents)}</TableCell>
                  <TableCell className="text-right font-mono">{fmtDollars(section.totalVarianceCents)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ── Small row helpers ─────────────────────────────────────────────────────────

function SectionHeaderRow({ label }: { label: string }) {
  return (
    <TableRow className="bg-muted/40">
      <TableCell colSpan={2} className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </TableCell>
    </TableRow>
  );
}

function AmountRow({ name, cents }: { name: string; cents: number }) {
  return (
    <TableRow>
      <TableCell className="pl-6">{name}</TableCell>
      <TableCell className="text-right font-mono">{fmtDollars(cents)}</TableCell>
    </TableRow>
  );
}

function TotalRow({ label, cents }: { label: string; cents: number }) {
  return (
    <TableRow className="font-semibold">
      <TableCell>{label}</TableCell>
      <TableCell className="text-right font-mono">{fmtDollars(cents)}</TableCell>
    </TableRow>
  );
}

function NetRow({ label, cents }: { label: string; cents: number }) {
  return (
    <TableRow className="border-t-2">
      <TableCell className="font-semibold">{label}</TableCell>
      <TableCell
        className={cn(
          "text-right font-mono font-semibold",
          cents < 0 ? "text-destructive" : "text-emerald-600 dark:text-emerald-400",
        )}
      >
        {fmtDollars(cents)}
      </TableCell>
    </TableRow>
  );
}

function MutedRow({ label }: { label: string }) {
  return (
    <TableRow>
      <TableCell colSpan={2} className="pl-6 text-sm text-muted-foreground">
        {label}
      </TableCell>
    </TableRow>
  );
}

function EmptyStatement({ label }: { label: string }) {
  return (
    <Card>
      <CardContent className="py-10 text-center text-sm text-muted-foreground">{label}</CardContent>
    </Card>
  );
}
