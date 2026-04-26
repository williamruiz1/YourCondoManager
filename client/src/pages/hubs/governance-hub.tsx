// @zone: Governance
// @persona: Manager, Board Officer, Assisted Board, PM Assistant, Viewer
//
// 3.2 Q3 Governance zone hub — Phase 11 navigation surface.
// Replaces the previous /app/governance content (which now lives at
// /app/governance/overview). Per 1.2 Q2: zone title, brief description,
// sub-page link list, optional summary widget. No forms, no deep tables.
//
// HubAlertWidget mounts at the top per 4.1 Q9.
//
// 5.5 / 5.6 (Wave 21) — strings consumed via i18n registry; copy lives in
// `client/src/i18n/strings.en.ts`.

import { Link } from "wouter";
import {
  Landmark,
  ChevronRight,
  Vote,
  CalendarDays,
  ShieldCheck,
  FileText,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { WorkspacePageHeader } from "@/components/workspace-page-header";
import { HubAlertWidget } from "@/components/hub-alert-widget";
import { Card, CardContent } from "@/components/ui/card";
import { t } from "@/i18n/use-strings";

interface HubLink {
  href: string;
  title: string;
  description: string;
  icon: LucideIcon;
  testId: string;
}

const SUB_PAGES: ReadonlyArray<HubLink> = [
  {
    href: "/app/governance/overview",
    title: "Governance Overview",
    description: "Meetings, elections, board packages, and compliance.",
    icon: Landmark,
    testId: "link-governance-hub-overview",
  },
  {
    href: "/app/board",
    title: "Board",
    description: "Board members and officer assignments.",
    icon: Users,
    testId: "link-governance-hub-board",
  },
  {
    href: "/app/documents",
    title: "Documents",
    description: "Bylaws, policies, and governing documents.",
    icon: FileText,
    testId: "link-governance-hub-documents",
  },
];

export default function GovernanceHub() {
  useDocumentTitle(t("hub.governance.title"));

  return (
    <div className="container mx-auto py-6 space-y-6">
      <WorkspacePageHeader
        title={t("hub.governance.title")}
        summary={t("hub.governance.summary")}
        breadcrumbs={[{ label: t("home.title"), href: "/app" }, { label: t("hub.governance.title") }]}
      />
      <HubAlertWidget zone="Governance" />
      <div
        className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"
        data-testid="governance-hub-links"
      >
        {SUB_PAGES.map((link) => {
          const Icon = link.icon;
          return (
            <Link key={link.href} href={link.href} data-testid={link.testId}>
              <Card className="h-full cursor-pointer transition-colors hover:bg-accent/40 focus-within:ring-2 focus-within:ring-ring">
                <CardContent className="flex h-full items-start gap-3 p-4">
                  <Icon className="h-5 w-5 mt-0.5 text-primary flex-shrink-0" aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-sm font-semibold text-foreground">{link.title}</h3>
                      <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" aria-hidden="true" />
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{link.description}</p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
