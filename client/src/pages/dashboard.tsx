import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, DoorOpen, Users, Home, UserCheck, FileText } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface DashboardStats {
  totalAssociations: number;
  totalUnits: number;
  totalOwners: number;
  totalTenants: number;
  totalBoardMembers: number;
  totalDocuments: number;
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
  const { data: stats, isLoading } = useQuery<DashboardStats>({
    queryKey: ["/api/dashboard/stats"],
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
          Overview of your condo property management platform.
        </p>
      </div>

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => (
          <StatCard key={card.title} {...card} loading={isLoading} />
        ))}
      </div>
    </div>
  );
}
