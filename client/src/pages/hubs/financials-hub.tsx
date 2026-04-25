// @zone: Financials
// @persona: Manager, Board Officer, Assisted Board, PM Assistant, Viewer
//
// 3.2 Q1 Financials zone hub — Phase 11 placeholder + 4.1 Wave 5 alert widget.
// Widget mounts at the top of the hub content per 4.1 Q9.
//
// 5.5 / 5.6 (Wave 21) — strings consumed via i18n registry; copy lives in
// `client/src/i18n/strings.en.ts`.

import { Link } from "wouter";
import { ArrowLeft, Wallet } from "lucide-react";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { WorkspacePageHeader } from "@/components/workspace-page-header";
import { EmptyState } from "@/components/empty-state";
import { HubAlertWidget } from "@/components/hub-alert-widget";
import { t } from "@/i18n/use-strings";

export default function FinancialsHub() {
  useDocumentTitle(t("hub.financials.title"));

  return (
    <div className="container mx-auto py-6 space-y-6">
      <WorkspacePageHeader
        title={t("hub.financials.title")}
        summary={t("hub.financials.summary")}
        breadcrumbs={[{ label: t("home.title"), href: "/app" }, { label: t("hub.financials.title") }]}
      />
      <HubAlertWidget zone="Financials" />
      <EmptyState
        icon={Wallet}
        title={t("hub.financials.empty.title")}
        description={t("hub.financials.empty.body")}
        testId="financials-hub-empty"
      />
      <div className="text-center">
        <Link
          href="/app"
          className="inline-flex items-center gap-2 rounded text-sm text-primary hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          data-testid="link-financials-hub-return-home"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> {t("hub.financials.returnHome")}
        </Link>
      </div>
    </div>
  );
}
