// zone: Financials
// persona: Manager, Board Officer, Assisted Board, PM Assistant
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { WorkspacePageHeader } from "@/components/workspace-page-header";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { t } from "@/i18n/use-strings";
import { financeSubPages } from "@/lib/sub-page-nav";
import { FinancialLedgerContent } from "./financial-ledger";
import { FinancialAssessmentsContent } from "./financial-assessments";
import { FinancialLateFeesContent } from "./financial-late-fees";
import { FinancialDelinquencyContent } from "./financial-delinquency";

export default function FinancialBillingPage() {
  useDocumentTitle(t("financialBilling.title"));
  return (
    // Wave 23 a11y: section + aria-labelledby ties the page region to its
    // visible heading rendered by WorkspacePageHeader (id propagated below).
    <section className="flex flex-col min-h-0" aria-labelledby="financial-billing-heading">
      <div className="p-6 space-y-6">
        <WorkspacePageHeader
          title={t("financialBilling.title")}
          headingId="financial-billing-heading"
          summary={t("financialBilling.summary")}
          eyebrow={t("common.eyebrow.finance")}
          breadcrumbs={[
            { label: t("common.crumb.finance"), href: "/app/financials" },
            { label: t("financialBilling.crumb") },
          ]}
          subPages={financeSubPages}
        />
        <Tabs defaultValue="ledger" className="space-y-6">
          <TabsList>
            <TabsTrigger value="ledger">{t("financialBilling.tabs.ledger")}</TabsTrigger>
            <TabsTrigger value="assessments">{t("financialBilling.tabs.assessments")}</TabsTrigger>
            <TabsTrigger value="late-fees">{t("financialBilling.tabs.lateFees")}</TabsTrigger>
            <TabsTrigger value="delinquency">{t("financialBilling.tabs.delinquency")}</TabsTrigger>
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
    </section>
  );
}
