// @zone: Operations
// @persona: Manager, Board Officer, Assisted Board, PM Assistant, Viewer
//
// 3.2 Q2 Operations zone hub — Phase 11 navigation surface + 4.1 Wave 5
// alert widget. Coexists with /app/operations/dashboard (Operations
// Overview) per 0.1 AC 7 — the hub is a navigational surface and does
// NOT redirect to the Overview dashboard.
//
// HubAlertWidget mounts at the top per 4.1 Q9.
//
// 5.5 / 5.6 (Wave 21) — strings consumed via i18n registry; copy lives in
// `client/src/i18n/strings.en.ts`.

import { Link } from "wouter";
import {
  ChevronRight,
  ClipboardList,
  Wrench,
  SearchCheck,
  BriefcaseBusiness,
  MessageCircle,
  ListChecks,
  DoorOpen,
  Users,
  ShieldCheck,
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
    href: "/app/operations/dashboard",
    title: "Operations Overview",
    description: "Open work, vendor performance, and risk indicators.",
    icon: ListChecks,
    testId: "link-operations-hub-overview",
  },
  {
    href: "/app/work-orders",
    title: "Work Orders",
    description: "Active and historical maintenance work.",
    icon: ClipboardList,
    testId: "link-operations-hub-work-orders",
  },
  {
    href: "/app/maintenance-schedules",
    title: "Maintenance",
    description: "Recurring maintenance and PM schedules.",
    icon: Wrench,
    testId: "link-operations-hub-maintenance",
  },
  {
    href: "/app/inspections",
    title: "Inspections",
    description: "Property inspection workflow and findings.",
    icon: SearchCheck,
    testId: "link-operations-hub-inspections",
  },
  {
    href: "/app/vendors",
    title: "Vendors",
    description: "Vendor directory and contracts.",
    icon: BriefcaseBusiness,
    testId: "link-operations-hub-vendors",
  },
  {
    href: "/app/insurance",
    title: "Insurance",
    description: "Insurance policies and risk coverage.",
    icon: ShieldCheck,
    testId: "link-operations-hub-insurance",
  },
  {
    href: "/app/units",
    title: "Buildings & Units",
    description: "Building, unit, and occupancy records.",
    icon: DoorOpen,
    testId: "link-operations-hub-units",
  },
  {
    href: "/app/persons",
    title: "People",
    description: "Owners, residents, and contacts.",
    icon: Users,
    testId: "link-operations-hub-persons",
  },
  {
    href: "/app/resident-feedback",
    title: "Feedback",
    description: "Resident issue reports and triage.",
    icon: MessageCircle,
    testId: "link-operations-hub-feedback",
  },
];

export default function OperationsHub() {
  useDocumentTitle(t("hub.operations.title"));

  return (
    <div className="container mx-auto py-6 space-y-6">
      <WorkspacePageHeader
        title={t("hub.operations.title")}
        summary={t("hub.operations.summary")}
        breadcrumbs={[{ label: t("home.title"), href: "/app" }, { label: t("hub.operations.title") }]}
      />
      <HubAlertWidget zone="Operations" />
      <div
        className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"
        data-testid="operations-hub-links"
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
