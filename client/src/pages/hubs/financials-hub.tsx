// @zone: Financials
// @persona: Manager, Board Officer, Assisted Board, PM Assistant, Viewer
//
// 3.2 Q1 Financials zone hub — Phase 11 placeholder + 4.1 Wave 5 alert widget.
// Widget mounts at the top of the hub content per 4.1 Q9.

import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { WorkspacePageHeader } from "@/components/workspace-page-header";
import { Card, CardContent } from "@/components/ui/card";
import { HubAlertWidget } from "@/components/hub-alert-widget";

export default function FinancialsHub() {
  useDocumentTitle("Financials");

  return (
    <div className="container mx-auto py-6 space-y-6">
      <WorkspacePageHeader
        title="Financials"
        summary="Upcoming overview of payments, billing, reports, and expenses."
        breadcrumbs={[{ label: "Home", href: "/app" }, { label: "Financials" }]}
      />
      <HubAlertWidget zone="Financials" />
      <Card>
        <CardContent className="py-12 text-center space-y-4">
          <p className="text-lg text-muted-foreground">
            Financials zone hub — upcoming overview of payments, billing, reports, and expenses.
          </p>
          <p className="text-sm text-muted-foreground">
            Zone hub content coming in Phase 12-15.
          </p>
          <Link
            href="/app"
            className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
            data-testid="link-financials-hub-return-home"
          >
            <ArrowLeft className="h-4 w-4" /> Return to Home
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
