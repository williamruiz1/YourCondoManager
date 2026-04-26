// @zone: Financials
// @persona: Manager, Board Officer, Assisted Board, PM Assistant, Viewer
//
// 3.2 Q1 Financials zone hub — Phase 11 navigation surface + 4.1 Wave 5
// alert widget. Per 1.2 Q2: zone title, brief description, sub-page link
// list, optional summary widget. No forms, no deep tables.
//
// HubAlertWidget mounts at the top per 4.1 Q9.
//
// 5.5 / 5.6 (Wave 21) — strings consumed via i18n registry; copy lives in
// `client/src/i18n/strings.en.ts`.

import { Link } from "wouter";
import {
  ChevronRight,
  Layers,
  Receipt,
  CreditCard,
  Banknote,
  BarChart3,
  Gavel,
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
    href: "/app/financial/foundation",
    title: "Chart of Accounts",
    description: "Account hierarchy and financial foundation.",
    icon: Layers,
    testId: "link-financials-hub-foundation",
  },
  {
    href: "/app/financial/billing",
    title: "Billing",
    description: "Invoices, ledgers, and assessment billing.",
    icon: Receipt,
    testId: "link-financials-hub-billing",
  },
  {
    href: "/app/financial/rules",
    title: "Assessment Rules",
    description: "Recurring assessment rules and run history.",
    icon: Gavel,
    testId: "link-financials-hub-rules",
  },
  {
    href: "/app/financial/payments",
    title: "Payments",
    description: "Payment receipts, autopay, and reconciliation.",
    icon: CreditCard,
    testId: "link-financials-hub-payments",
  },
  {
    href: "/app/financial/expenses",
    title: "Expenses",
    description: "Vendor invoices, budgets, and utilities.",
    icon: Banknote,
    testId: "link-financials-hub-expenses",
  },
  {
    href: "/app/financial/reports",
    title: "Reports",
    description: "Financial summaries and audit trails.",
    icon: BarChart3,
    testId: "link-financials-hub-reports",
  },
];

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
      <div
        className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"
        data-testid="financials-hub-links"
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
