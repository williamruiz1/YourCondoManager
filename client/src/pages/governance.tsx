// zone: Governance
// persona: Manager, Board Officer, Assisted Board, PM Assistant
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { WorkspacePageHeader } from "@/components/workspace-page-header";
import { boardGovernanceSubPages } from "@/lib/sub-page-nav";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { HubAlertWidget } from "@/components/hub-alert-widget";
import { MeetingsContent } from "./meetings";
import { BoardPackagesContent } from "./board-packages";
import { ElectionsContent } from "./elections";
import { GovernanceComplianceContent } from "./governance-compliance";
import { t } from "@/i18n/use-strings";

export default function GovernancePage() {
  useDocumentTitle(t("governance.title"));
  // Wave 31 a11y: section landmark + aria-labelledby (heading id below).
  return (
    <section className="flex flex-col min-h-0" aria-labelledby="governance-heading">
      <div className="p-6 space-y-6">
        <WorkspacePageHeader
          title={t("governance.title")}
          headingId="governance-heading"
          summary={t("governance.summary")}
          eyebrow={t("governance.eyebrow")}
          breadcrumbs={[{ label: t("common.crumb.board"), href: "/app/board" }, { label: t("governance.crumb") }]}
          subPages={boardGovernanceSubPages}
        />
        <HubAlertWidget zone="Governance" />
        <Tabs defaultValue="meetings" className="space-y-6">
          <TabsList>
            <TabsTrigger value="meetings">{t("governance.tabs.meetings")}</TabsTrigger>
            <TabsTrigger value="packages">{t("governance.tabs.packages")}</TabsTrigger>
            <TabsTrigger value="elections">{t("governance.tabs.elections")}</TabsTrigger>
            <TabsTrigger value="compliance">{t("governance.tabs.compliance")}</TabsTrigger>
          </TabsList>
          <TabsContent value="meetings" className="mt-0 space-y-6">
            <MeetingsContent />
          </TabsContent>
          <TabsContent value="packages" className="mt-0 space-y-6">
            <BoardPackagesContent />
          </TabsContent>
          <TabsContent value="elections" className="mt-0 space-y-5">
            <ElectionsContent />
          </TabsContent>
          <TabsContent value="compliance" className="mt-0 space-y-6">
            <GovernanceComplianceContent />
          </TabsContent>
        </Tabs>
      </div>
    </section>
  );
}
