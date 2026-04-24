// @zone: Governance
// @persona: Manager, Board Officer, Assisted Board, PM Assistant, Viewer
//
// 3.2 Q1 Governance zone hub — Phase 11 placeholder.
// Activates when hub content is designed; route wiring lands in Phase 14.
// No business logic, no data fetch. See plan §3 Phase 11.

import { Link } from "wouter";
import { ArrowLeft, Landmark } from "lucide-react";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { WorkspacePageHeader } from "@/components/workspace-page-header";
import { EmptyState } from "@/components/empty-state";

export default function GovernanceHub() {
  useDocumentTitle("Governance");

  return (
    <div className="container mx-auto py-6 space-y-6">
      <WorkspacePageHeader
        title="Governance"
        summary="Upcoming overview of board activities, elections, meetings, and compliance."
        breadcrumbs={[{ label: "Home", href: "/app" }, { label: "Governance" }]}
      />
      <EmptyState
        icon={Landmark}
        title="Governance zone hub coming soon"
        description="This hub will surface an overview of board activities, elections, meetings, and compliance."
        testId="governance-hub-empty"
      />
      <div className="text-center">
        <Link
          href="/app"
          className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
          data-testid="link-governance-hub-return-home"
        >
          <ArrowLeft className="h-4 w-4" /> Return to Home
        </Link>
      </div>
    </div>
  );
}
