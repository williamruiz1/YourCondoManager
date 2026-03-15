import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, DoorOpen, Users, Home, UserCheck, FileText } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useAssociationContext } from "@/context/association-context";
import { WorkspacePageHeader } from "@/components/workspace-page-header";
import { AssociationScopeBanner } from "@/components/association-scope-banner";
import { AsyncStateBoundary } from "@/components/async-state-boundary";
import { RecommendedActionsPanel } from "@/components/recommended-actions-panel";
import type { RecommendedAction } from "@/components/recommended-actions-panel";

interface DashboardStats {
  totalAssociations: number;
  totalUnits: number;
  totalOwners: number;
  totalTenants: number;
  totalBoardMembers: number;
  totalDocuments: number;
}

interface AssociationSummary {
  id: string;
  name: string;
  city: string;
  state: string;
}

function StatCard({
  title,
  value,
  icon: Icon,
  description,
  loading,
  testId,
}: {
  title: string;
  value: number;
  icon: typeof Building2;
  description: string;
  loading: boolean;
  testId: string;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-8 w-16" />
        ) : (
          <div className="text-2xl font-bold" data-testid={testId}>
            {value}
          </div>
        )}
        <p className="text-xs text-muted-foreground mt-1">{description}</p>
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const { activeAssociationId, setActiveAssociationId } = useAssociationContext();
  const { data: stats, isLoading } = useQuery<DashboardStats>({
    queryKey: ["/api/dashboard/stats"],
  });
  const { data: associations = [], isLoading: associationsLoading } = useQuery<AssociationSummary[]>({
    queryKey: ["/api/associations"],
  });

  const cards = [
    {
      title: "Associations",
      value: stats?.totalAssociations ?? 0,
      icon: Building2,
      description: "Active condo associations",
      testId: "stat-associations",
    },
    {
      title: "Units",
      value: stats?.totalUnits ?? 0,
      icon: DoorOpen,
      description: "Registered units",
      testId: "stat-units",
    },
    {
      title: "Owners",
      value: stats?.totalOwners ?? 0,
      icon: Users,
      description: "Property owners",
      testId: "stat-owners",
    },
    {
      title: "Tenants",
      value: stats?.totalTenants ?? 0,
      icon: Home,
      description: "Active tenants",
      testId: "stat-tenants",
    },
    {
      title: "Board Members",
      value: stats?.totalBoardMembers ?? 0,
      icon: UserCheck,
      description: "Active board members",
      testId: "stat-board",
    },
    {
      title: "Documents",
      value: stats?.totalDocuments ?? 0,
      icon: FileText,
      description: "Uploaded documents",
      testId: "stat-documents",
    },
  ];
  const portfolioActions: RecommendedAction[] = [
    {
      title: activeAssociationId ? "Continue work in the selected association" : "Set an active association context",
      summary: activeAssociationId
        ? "Move from portfolio oversight into the in-context operating workspace for the selected association."
        : "Select a property so actions, forms, and filtered records stay scoped to the right association.",
      href: activeAssociationId ? "/app/association-context" : "/app/associations",
      cta: activeAssociationId ? "Open association workspace" : "Manage associations",
      tone: "default" as const,
    },
    {
      title: (stats?.totalDocuments ?? 0) === 0 ? "Start the document repository" : "Review document coverage",
      summary: (stats?.totalDocuments ?? 0) === 0
        ? "No documents are filed yet. Upload bylaws, policies, and meeting records so operations have a source of truth."
        : "Use the repository to close gaps in policies, minutes, financial reports, and operating records.",
      href: "/app/documents",
      cta: "Open documents",
      tone: (stats?.totalDocuments ?? 0) === 0 ? ("warning" as const) : ("neutral" as const),
    },
    {
      title: "Review board and owner coverage",
      summary: "Check whether board and resident records are complete before moving deeper into workflows.",
      href: "/app/association-context",
      cta: "Review coverage",
      tone: "neutral" as const,
    },
  ];

  return (
    <div className="p-6 space-y-6">
      <WorkspacePageHeader
        title="Dashboard"
        summary="Portfolio overview across all managed associations, with direct access into the current in-context workspace."
        eyebrow="Workspace"
        breadcrumbs={[{ label: "Dashboard" }]}
        shortcuts={[
          { label: "Open Association Context", href: "/app/association-context" },
          { label: "Review Documents", href: "/app/documents" },
        ]}
      />

      <AssociationScopeBanner
        activeAssociationId={activeAssociationId}
        activeAssociationName={associations?.find((association) => association.id === activeAssociationId)?.name ?? ""}
        explanation={
          activeAssociationId
            ? "The selected association controls in-context pages, filtered records, and create actions across the admin workspace."
            : "Select an association to move from portfolio oversight into a scoped operating workspace."
        }
      />

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => (
          <StatCard key={card.title} {...card} loading={isLoading} />
        ))}
      </div>

      <RecommendedActionsPanel
        title="Portfolio Next Actions"
        description="Use the portfolio metrics above to decide where to move next."
        actions={portfolioActions}
      />

      <AsyncStateBoundary
        isLoading={associationsLoading}
        isEmpty={!associationsLoading && associations.length === 0}
        emptyTitle="No associations yet"
        emptyMessage="Create an association before using the portfolio workspace."
      >
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Associations</CardTitle>
            <Button asChild size="sm" variant="outline">
              <Link href="/app/associations">Manage Associations</Link>
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {associations.slice(0, 5).map((association) => (
                <div key={association.id} className="flex items-center justify-between rounded-md border p-2">
                  <div>
                    <p className="text-sm font-medium">{association.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {association.city}, {association.state}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant={association.id === activeAssociationId ? "default" : "outline"}
                    onClick={() => setActiveAssociationId(association.id)}
                    data-testid={`button-set-dashboard-context-${association.id}`}
                  >
                    {association.id === activeAssociationId ? "In Context" : "Use Context"}
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </AsyncStateBoundary>

      {activeAssociationId ? (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Current Association Context</CardTitle>
            <Button asChild size="sm" variant="outline">
              <Link href="/app/association-context">Open In-Context View</Link>
            </Button>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Portfolio stays here on the dashboard. Use the in-context view for the selected association’s overview,
            documents, buildings, units, ownership, and occupancy workflow.
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
