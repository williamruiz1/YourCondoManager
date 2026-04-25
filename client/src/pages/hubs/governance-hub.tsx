// @zone: Governance
// @persona: Manager, Board Officer, Assisted Board, PM Assistant, Viewer
//
// 3.2 Q1 Governance zone hub — Phase 11 placeholder.
// Activates when hub content is designed; route wiring lands in Phase 14.
// No business logic, no data fetch. See plan §3 Phase 11.
//
// 5.5 / 5.6 (Wave 21) — strings consumed via i18n registry; copy lives in
// `client/src/i18n/strings.en.ts`.

import { Link } from "wouter";
import { ArrowLeft, Landmark } from "lucide-react";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { WorkspacePageHeader } from "@/components/workspace-page-header";
import { EmptyState } from "@/components/empty-state";
import { t } from "@/i18n/use-strings";

export default function GovernanceHub() {
  useDocumentTitle(t("hub.governance.title"));

  return (
    <div className="container mx-auto py-6 space-y-6">
      <WorkspacePageHeader
        title={t("hub.governance.title")}
        summary={t("hub.governance.summary")}
        breadcrumbs={[{ label: t("home.title"), href: "/app" }, { label: t("hub.governance.title") }]}
      />
      <EmptyState
        icon={Landmark}
        title={t("hub.governance.empty.title")}
        description={t("hub.governance.empty.body")}
        testId="governance-hub-empty"
      />
      <div className="text-center">
        <Link
          href="/app"
          className="inline-flex items-center gap-2 rounded text-sm text-primary hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          data-testid="link-governance-hub-return-home"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> {t("hub.governance.returnHome")}
        </Link>
      </div>
    </div>
  );
}
