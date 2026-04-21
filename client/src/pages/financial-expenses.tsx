// zone: Financials
// persona: Manager, Board Officer, Assisted Board, PM Assistant
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { WorkspacePageHeader } from "@/components/workspace-page-header";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { financeSubPages } from "@/lib/sub-page-nav";
import { FinancialInvoicesContent } from "./financial-invoices";
import { FinancialUtilitiesContent } from "./financial-utilities";
import { FinancialBudgetsContent } from "./financial-budgets";

export default function FinancialExpensesPage() {
  useDocumentTitle("Expenses");
  return (
    <div className="flex flex-col min-h-0">
      <div className="p-6 space-y-6">
        <WorkspacePageHeader
          title="Expenses"
          summary="Track vendor invoices, utility payments, and budget variance in one place."
          eyebrow="Finance"
          breadcrumbs={[{ label: "Finance", href: "/app/financial/foundation" }, { label: "Expenses" }]}
          subPages={financeSubPages}
        />
        <Tabs defaultValue="invoices" className="space-y-6">
          <TabsList>
            <TabsTrigger value="invoices">Invoices</TabsTrigger>
            <TabsTrigger value="utilities">Utilities</TabsTrigger>
            <TabsTrigger value="budgets">Budgets</TabsTrigger>
          </TabsList>
          <TabsContent value="invoices" className="mt-0">
            <FinancialInvoicesContent />
          </TabsContent>
          <TabsContent value="utilities" className="mt-0">
            <FinancialUtilitiesContent />
          </TabsContent>
          <TabsContent value="budgets" className="mt-0">
            <FinancialBudgetsContent />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
