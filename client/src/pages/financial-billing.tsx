// zone: Financials
// persona: Manager, Board Officer, Assisted Board, PM Assistant
//
// YCM Redesign — Billing & Dues + Ledger restyled onto the shared
// @ycm/design-system (F1, founder-os#10187), mirroring the M1 Dashboard
// restyle pattern. ALL live data wiring, tabs, dialogs, and mutations are
// preserved verbatim — only the presentation layer (typography, card/table
// chrome) is restyled via the `.ds-scope .fin-ds` scope (see
// styles/financial-redesign.css). This wrapper covers all 5 tabs (Ledger,
// Assessments, Late Fees, Delinquency, Liens) since they're rendered inside it.
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { WorkspacePageHeader } from "@/components/workspace-page-header";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { t } from "@/i18n/use-strings";
import { financeSubPages } from "@/lib/sub-page-nav";
import { FinancialLedgerContent } from "./financial-ledger";
import { FinancialAssessmentsContent } from "./financial-assessments";
import { FinancialLateFeesContent } from "./financial-late-fees";
import { FinancialDelinquencyContent } from "./financial-delinquency";
import { FinancialLiensContent } from "./financial-liens";
import "@/styles/redesign-kit.css";
import "@/styles/financial-redesign.css";

export default function FinancialBillingPage() {
  useDocumentTitle(t("financialBilling.title"));
  return (
    // Wave 23 a11y: section + aria-labelledby ties the page region to its
    // visible heading rendered by WorkspacePageHeader (id propagated below).
    <section className="flex flex-col min-h-0 ds-scope fin-ds" aria-labelledby="financial-billing-heading">
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
            <TabsTrigger value="liens">Liens</TabsTrigger>
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
          <TabsContent value="liens" className="mt-0">
            <FinancialLiensContent />
          </TabsContent>
        </Tabs>
      </div>
    </section>
  );
}
