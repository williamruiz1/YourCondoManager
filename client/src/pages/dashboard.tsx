import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, DoorOpen, Users, Home, UserCheck, FileText } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useAssociationContext } from "@/context/association-context";

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

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight" data-testid="text-page-title">
          Dashboard
        </h1>
        <p className="text-muted-foreground">
          Portfolio overview across all managed associations.
        </p>
      </div>

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => (
          <StatCard key={card.title} {...card} loading={isLoading} />
        ))}
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Associations</CardTitle>
          <Button asChild size="sm" variant="outline">
            <Link href="/app/associations">Manage Associations</Link>
          </Button>
        </CardHeader>
        <CardContent>
          {associationsLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-5 w-full" />
              <Skeleton className="h-5 w-4/5" />
            </div>
          ) : associations.length === 0 ? (
            <p className="text-sm text-muted-foreground">No associations yet.</p>
          ) : (
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
          )}
        </CardContent>
      </Card>

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
