// @zone: Communications
// @persona: Manager, Board Officer, Assisted Board, PM Assistant, Viewer
//
// 3.2 Q3 Communications zone hub — Phase 11 navigation surface.
// Replaces the previous /app/communications content (which now lives at
// /app/communications/overview). Per 1.2 Q2: zone title, brief description,
// sub-page link list, optional summary widget. No forms, no deep tables.
//
// HubAlertWidget mounts at the top per 4.1 Q9.
//
// 5.5 / 5.6 (Wave 21) — strings consumed via i18n registry; copy lives in
// `client/src/i18n/strings.en.ts`.

import { Link } from "wouter";
import {
  Megaphone,
  ChevronRight,
  Inbox,
  Globe,
  MessageSquare,
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
    href: "/app/communications/inbox",
    title: "Inbox",
    description: "Cross-association alerts and updates.",
    icon: Inbox,
    testId: "link-communications-hub-inbox",
  },
  {
    href: "/app/communications/overview",
    title: "Communications Overview",
    description: "Notices, message history, and delivery channels.",
    icon: MessageSquare,
    testId: "link-communications-hub-overview",
  },
  {
    href: "/app/announcements",
    title: "Announcements",
    description: "Author and publish association announcements.",
    icon: Megaphone,
    testId: "link-communications-hub-announcements",
  },
  {
    href: "/app/community-hub",
    title: "Community Hub",
    description: "Public-facing community page management.",
    icon: Globe,
    testId: "link-communications-hub-community",
  },
];

export default function CommunicationsHub() {
  useDocumentTitle(t("hub.communications.title"));

  return (
    <div className="container mx-auto py-6 space-y-6">
      <WorkspacePageHeader
        title={t("hub.communications.title")}
        summary={t("hub.communications.summary")}
        breadcrumbs={[{ label: t("home.title"), href: "/app" }, { label: t("hub.communications.title") }]}
      />
      <HubAlertWidget zone="Communications" />
      <div
        className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"
        data-testid="communications-hub-links"
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
