// zone: Governance
// persona: Manager, Board Officer, Assisted Board, PM Assistant
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { WorkspacePageHeader } from "@/components/workspace-page-header";
import { boardGovernanceSubPages } from "@/lib/sub-page-nav";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { MeetingsContent } from "./meetings";
import { BoardPackagesContent } from "./board-packages";
import { ElectionsContent } from "./elections";
import { GovernanceComplianceContent } from "./governance-compliance";

export default function GovernancePage() {
  useDocumentTitle("Governance Overview");
  return (
    <div className="flex flex-col min-h-0">
      <div className="p-6 space-y-6">
        <WorkspacePageHeader
          title="Governance"
          summary="Manage meetings, board packages, elections, and compliance in one place."
          eyebrow="Board & Governance"
          breadcrumbs={[{ label: "Board", href: "/app/board" }, { label: "Governance" }]}
          subPages={boardGovernanceSubPages}
        />
        <Tabs defaultValue="meetings" className="space-y-6">
          <TabsList>
            <TabsTrigger value="meetings">Meetings</TabsTrigger>
            <TabsTrigger value="packages">Board Packages</TabsTrigger>
            <TabsTrigger value="elections">Elections</TabsTrigger>
            <TabsTrigger value="compliance">Compliance</TabsTrigger>
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
    </div>
  );
}
