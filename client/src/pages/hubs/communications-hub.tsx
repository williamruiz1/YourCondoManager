// @zone: Communications
// @persona: Manager, Board Officer, Assisted Board, PM Assistant, Viewer
//
// 3.2 Q1 Communications zone hub — Phase 11 placeholder.
// Activates when hub content is designed; route wiring lands in Phase 15.
// No business logic, no data fetch. See plan §3 Phase 11.
//
// 5.5 / 5.6 (Wave 21) — strings consumed via i18n registry; copy lives in
// `client/src/i18n/strings.en.ts`.

import { Link } from "wouter";
import { ArrowLeft, Megaphone } from "lucide-react";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { WorkspacePageHeader } from "@/components/workspace-page-header";
import { EmptyState } from "@/components/empty-state";
import { t } from "@/i18n/use-strings";

export default function CommunicationsHub() {
  useDocumentTitle(t("hub.communications.title"));

  return (
    <div className="container mx-auto py-6 space-y-6">
      <WorkspacePageHeader
        title={t("hub.communications.title")}
        summary={t("hub.communications.summary")}
        breadcrumbs={[{ label: t("home.title"), href: "/app" }, { label: t("hub.communications.title") }]}
      />
      <EmptyState
        icon={Megaphone}
        title={t("hub.communications.empty.title")}
        description={t("hub.communications.empty.body")}
        testId="communications-hub-empty"
      />
      <div className="text-center">
        <Link
          href="/app"
          className="inline-flex items-center gap-2 rounded text-sm text-primary hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          data-testid="link-communications-hub-return-home"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> {t("hub.communications.returnHome")}
        </Link>
      </div>
    </div>
  );
}
