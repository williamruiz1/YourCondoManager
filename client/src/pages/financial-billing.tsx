import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { WorkspacePageHeader } from "@/components/workspace-page-header";
import { financeSubPages } from "@/lib/sub-page-nav";
import { FinancialLedgerContent } from "./financial-ledger";
import { FinancialAssessmentsContent } from "./financial-assessments";
import { FinancialLateFeesContent } from "./financial-late-fees";
import { FinancialDelinquencyContent } from "./financial-delinquency";

export default function FinancialBillingPage() {
  return (
    <div className="flex flex-col min-h-0">
      <div className="p-6 space-y-6">
        <WorkspacePageHeader
          title="Billing"
          summary="Manage owner ledger entries, special assessments, late fee rules, and delinquency escalations."
          eyebrow="Finance"
          breadcrumbs={[{ label: "Finance", href: "/app/financial/foundation" }, { label: "Billing" }]}
          subPages={financeSubPages}
        />
        <Tabs defaultValue="ledger" className="space-y-6">
          <TabsList>
            <TabsTrigger value="ledger">Owner Ledger</TabsTrigger>
            <TabsTrigger value="assessments">Assessments</TabsTrigger>
            <TabsTrigger value="late-fees">Late Fees</TabsTrigger>
            <TabsTrigger value="delinquency">Delinquency</TabsTrigger>
          </TabsList>
          <TabsContent value="ledger" className="mt-0">
            <FinancialLedgerContent />
          </TabsContent>
          <TabsContent value="assessments" className="mt-0">
            <FinancialAssessmentsContent />
          </TabsContent>
          <TabsContent value="late-fees" className="mt-0">
            <FinancialLateFeesContent />
          </TabsContent>
          <TabsContent value="delinquency" className="mt-0">
            <FinancialDelinquencyContent />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
