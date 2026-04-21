// zone: Operations
// persona: Manager, Board Officer, Assisted Board, PM Assistant
import { useQuery } from "@tanstack/react-query";
import type { InspectionRecord, MaintenanceScheduleInstance, WorkOrder } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { AuditLog } from "@shared/schema";
import { WorkspacePageHeader } from "@/components/workspace-page-header";
import { operationsSubPages } from "@/lib/sub-page-nav";
import { RecommendedActionsPanel } from "@/components/recommended-actions-panel";
import { useIsMobile } from "@/hooks/use-mobile";
import { MobileSectionShell } from "@/components/mobile-section-shell";
import { Skeleton } from "@/components/ui/skeleton";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";

type OperationsDashboardData = {
  totals: {
    openWorkOrders: number;
    dueMaintenance: number;
    openFindings: number;
    activeVendors: number;
    pendingRenewalVendors: number;
    overdueInstances: number;
  };
  workOrderAging: { open: number; inProgress: number; pendingReview: number; closed: number };
  vendorStatus: { active: number; inactive: number; pendingRenewal: number };
  recentWorkOrders: WorkOrder[];
  dueInstances: MaintenanceScheduleInstance[];
  recentInspections: InspectionRecord[];
  recentAudit: AuditLog[];
};

export default function OperationsDashboardPage() {
  useDocumentTitle("Operations Overview");
  const isMobile = useIsMobile();
  const { data, isLoading } = useQuery<OperationsDashboardData>({
    queryKey: ["/api/operations/dashboard"],
  });

  async function downloadReport(reportType: "vendors" | "work-orders" | "maintenance") {
    const res = await fetch(`/api/operations/reports/${reportType}`, {
      credentials: "include",
    });
    if (!res.ok) {
      throw new Error((await res.text()) || res.statusText);
    }
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${reportType}-report.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.URL.revokeObjectURL(url);
  }

  const totals = data?.totals;
  const recommendedActions = [
    {
      title: (totals?.openWorkOrders ?? 0) > 0 ? "Work the active maintenance queue" : "No active work-order pressure",
      summary: (totals?.openWorkOrders ?? 0) > 0
        ? `${totals?.openWorkOrders ?? 0} work orders still need action. Review assignments and move stalled orders forward.`
        : "The work-order queue is clear right now. Use the board to review preventive maintenance and audit history.",
      href: "/app/work-orders",
      cta: "Open work orders",
      tone: (totals?.openWorkOrders ?? 0) > 0 ? "warning" as const : "neutral" as const,
    },
    {
      title: (totals?.pendingRenewalVendors ?? 0) > 0 ? "Resolve vendor renewal risk" : "Vendor compliance looks stable",
      summary: (totals?.pendingRenewalVendors ?? 0) > 0
        ? `${totals?.pendingRenewalVendors ?? 0} vendors are in renewal risk. Review insurance expirations and update records.`
        : "Vendor registry health is stable. Use the registry to add missing contracts and compliance files.",
      href: "/app/vendors",
      cta: "Open vendor registry",
      tone: (totals?.pendingRenewalVendors ?? 0) > 0 ? "warning" as const : "neutral" as const,
    },
    {
      title: (totals?.dueMaintenance ?? 0) > 0 ? "Triage preventive maintenance due now" : "Preventive schedule is under control",
      summary: (totals?.dueMaintenance ?? 0) > 0
        ? `${totals?.dueMaintenance ?? 0} maintenance instances are due. Convert them into scheduled work before they slip overdue.`
        : "No immediate maintenance due count is showing. Review schedules and recent inspections to stay ahead.",
      href: "/app/maintenance-schedules",
      cta: "Open maintenance schedules",
      tone: (totals?.dueMaintenance ?? 0) > 0 ? "default" as const : "neutral" as const,
    },
  ];

  const statCards = [
    ["Open Work Orders", totals?.openWorkOrders],
    ["Due Maintenance", totals?.dueMaintenance],
    ["Open Findings", totals?.openFindings],
    ["Active Vendors", totals?.activeVendors],
    ["Renewal Risk", totals?.pendingRenewalVendors],
    ["Overdue Instances", totals?.overdueInstances],
  ] as const;

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <WorkspacePageHeader
        title="Operations Dashboard"
        summary="Monitor active work, preventive maintenance pressure, vendor risk, and inspection follow-up from one operations view."
        eyebrow="Operations"
        breadcrumbs={[{ label: "Dashboard", href: "/app" }, { label: "Operations Dashboard" }]}
        shortcuts={[
          { label: "Open Work Orders", href: "/app/work-orders" },
          { label: "Open Vendors", href: "/app/vendors" },
        ]}
        subPages={operationsSubPages}
      />
      <div className="grid gap-2 sm:flex sm:flex-wrap">
        <Button className="min-h-11 justify-center sm:min-h-10" variant="outline" onClick={() => downloadReport("vendors")}>Export Vendor Report</Button>
        <Button className="min-h-11 justify-center sm:min-h-10" variant="outline" onClick={() => downloadReport("work-orders")}>Export Work Orders</Button>
        <Button className="min-h-11 justify-center sm:min-h-10" variant="outline" onClick={() => downloadReport("maintenance")}>Export Maintenance</Button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6">
        {statCards.map(([label, value]) => (
          <Card key={label}>
            <CardContent className="pt-6">
              <div className="text-sm text-muted-foreground">{label}</div>
              {isLoading ? <Skeleton className="mt-2 h-8 w-16" /> : <div className="text-2xl font-semibold">{value ?? 0}</div>}
            </CardContent>
          </Card>
        ))}
      </div>

      {isLoading ? (
        <Card>
          <CardContent className="space-y-3 p-6">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </CardContent>
        </Card>
      ) : (
        <RecommendedActionsPanel
          title="Operations Next Actions"
          description="These recommendations translate the dashboard counts into the next operational moves."
          actions={recommendedActions}
        />
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        {isMobile ? (
          <MobileSectionShell
            eyebrow="Snapshot"
            title="Operational Snapshot"
            summary="Use this condensed view to decide whether the next move is dispatch, vendor follow-up, or preventive maintenance triage."
          >
            <div className="space-y-4 text-sm">
              <div className="space-y-2">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Work Orders</div>
                <div className="space-y-2">
                  {isLoading ? (
                    <>
                      <Skeleton className="h-8 w-full" />
                      <Skeleton className="h-8 w-full" />
                      <Skeleton className="h-8 w-full" />
                      <Skeleton className="h-8 w-full" />
                    </>
                  ) : (
                    <>
                  <div className="flex items-center justify-between"><span>Open / Assigned</span><Badge variant="outline">{data?.workOrderAging.open ?? 0}</Badge></div>
                  <div className="flex items-center justify-between"><span>In Progress</span><Badge variant="outline">{data?.workOrderAging.inProgress ?? 0}</Badge></div>
                  <div className="flex items-center justify-between"><span>Pending Review</span><Badge variant="outline">{data?.workOrderAging.pendingReview ?? 0}</Badge></div>
                  <div className="flex items-center justify-between"><span>Closed</span><Badge variant="outline">{data?.workOrderAging.closed ?? 0}</Badge></div>
                    </>
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Vendors</div>
                <div className="space-y-2">
                  {isLoading ? (
                    <>
                      <Skeleton className="h-8 w-full" />
                      <Skeleton className="h-8 w-full" />
                      <Skeleton className="h-8 w-full" />
                    </>
                  ) : (
                    <>
                  <div className="flex items-center justify-between"><span>Active</span><Badge variant="outline">{data?.vendorStatus.active ?? 0}</Badge></div>
                  <div className="flex items-center justify-between"><span>Inactive</span><Badge variant="outline">{data?.vendorStatus.inactive ?? 0}</Badge></div>
                  <div className="flex items-center justify-between"><span>Pending Renewal</span><Badge variant="outline">{data?.vendorStatus.pendingRenewal ?? 0}</Badge></div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </MobileSectionShell>
        ) : (
          <>
            <Card>
              <CardHeader><CardTitle className="text-base">Work Order Aging</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="rounded-md border bg-muted/20 p-2 text-xs text-muted-foreground">
                  Use this breakdown to decide whether the team should dispatch, follow up, or close work.
                </div>
                {isLoading ? (
                  <>
                    <Skeleton className="h-8 w-full" />
                    <Skeleton className="h-8 w-full" />
                    <Skeleton className="h-8 w-full" />
                    <Skeleton className="h-8 w-full" />
                  </>
                ) : (
                  <>
                <div className="flex items-center justify-between"><span>Open / Assigned</span><Badge variant="outline">{data?.workOrderAging.open ?? 0}</Badge></div>
                <div className="flex items-center justify-between"><span>In Progress</span><Badge variant="outline">{data?.workOrderAging.inProgress ?? 0}</Badge></div>
                <div className="flex items-center justify-between"><span>Pending Review</span><Badge variant="outline">{data?.workOrderAging.pendingReview ?? 0}</Badge></div>
                <div className="flex items-center justify-between"><span>Closed</span><Badge variant="outline">{data?.workOrderAging.closed ?? 0}</Badge></div>
                  </>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">Vendor Status</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="rounded-md border bg-muted/20 p-2 text-xs text-muted-foreground">
                  Vendor status shows whether current compliance is strong enough to keep assigning operational work safely.
                </div>
                {isLoading ? (
                  <>
                    <Skeleton className="h-8 w-full" />
                    <Skeleton className="h-8 w-full" />
                    <Skeleton className="h-8 w-full" />
                  </>
                ) : (
                  <>
                <div className="flex items-center justify-between"><span>Active</span><Badge variant="outline">{data?.vendorStatus.active ?? 0}</Badge></div>
                <div className="flex items-center justify-between"><span>Inactive</span><Badge variant="outline">{data?.vendorStatus.inactive ?? 0}</Badge></div>
                <div className="flex items-center justify-between"><span>Pending Renewal</span><Badge variant="outline">{data?.vendorStatus.pendingRenewal ?? 0}</Badge></div>
                  </>
                )}
              </CardContent>
            </Card>
          </>
        )}
        <Card>
          <CardHeader><CardTitle className="text-base">Recent Inspections</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            {isMobile ? (
              <div className="text-xs text-muted-foreground">
                Review recent inspections to decide whether findings should become work orders or schedule changes.
              </div>
            ) : (
              <div className="rounded-md border bg-muted/20 p-2 text-xs text-muted-foreground">
                Review recent inspections to decide whether findings should become work orders or preventive schedule changes.
              </div>
            )}
            {isLoading ? (
              <>
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </>
            ) : (data?.recentInspections ?? []).slice(0, 5).map((record) => (
              <div key={record.id} className="rounded border p-3">
                <div className="font-medium">{record.locationText}</div>
                <div className="text-muted-foreground">{record.inspectionType} · {record.inspectorName}</div>
              </div>
            ))}
            {!isLoading && (data?.recentInspections ?? []).length === 0 ? <div className="text-muted-foreground">No inspections yet.</div> : null}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {isMobile ? (
          <MobileSectionShell
            eyebrow="Queue"
            title="Recent Work Orders"
            summary="Recent operational work stays in a stacked queue with status visible on the first line."
          >
            {isLoading ? (
              <>
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </>
            ) : (data?.recentWorkOrders ?? []).slice(0, 8).map((order) => (
              <div key={order.id} className="rounded border p-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="font-medium">{order.title}</div>
                  <div className="text-muted-foreground">{order.locationText || "No location"}</div>
                </div>
                <Badge variant="outline">{order.status}</Badge>
                </div>
              </div>
            ))}
            {!isLoading && (data?.recentWorkOrders ?? []).length === 0 ? <div className="text-muted-foreground">No work orders yet.</div> : null}
          </MobileSectionShell>
        ) : (
          <Card>
            <CardHeader><CardTitle className="text-base">Recent Work Orders</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              {isLoading ? (
                <>
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                </>
              ) : (data?.recentWorkOrders ?? []).slice(0, 8).map((order) => (
                <div key={order.id} className="rounded border p-3">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <div className="font-medium">{order.title}</div>
                      <div className="text-muted-foreground">{order.locationText || "No location"}</div>
                    </div>
                    <Badge variant="outline">{order.status}</Badge>
                  </div>
                </div>
              ))}
              {!isLoading && (data?.recentWorkOrders ?? []).length === 0 ? <div className="text-muted-foreground">No work orders yet.</div> : null}
            </CardContent>
          </Card>
        )}

        {isMobile ? (
          <MobileSectionShell
            eyebrow="Maintenance"
            title="Due Maintenance Instances"
            summary="Preventive work due now is stacked into a phone-readable queue with due date and linkage state visible."
          >
            {isLoading ? (
              <>
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </>
            ) : (data?.dueInstances ?? []).slice(0, 8).map((instance) => (
              <div key={instance.id} className="rounded border p-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="font-medium">{instance.title}</div>
                  <div className="text-muted-foreground">{new Date(instance.dueAt).toLocaleDateString()} · {instance.locationText}</div>
                </div>
                <Badge variant="outline">{instance.workOrderId ? "linked" : instance.status}</Badge>
                </div>
              </div>
            ))}
            {!isLoading && (data?.dueInstances ?? []).length === 0 ? <div className="text-muted-foreground">No due maintenance instances.</div> : null}
          </MobileSectionShell>
        ) : (
          <Card>
            <CardHeader><CardTitle className="text-base">Due Maintenance Instances</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              {isLoading ? (
                <>
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                </>
              ) : (data?.dueInstances ?? []).slice(0, 8).map((instance) => (
                <div key={instance.id} className="rounded border p-3">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <div className="font-medium">{instance.title}</div>
                      <div className="text-muted-foreground">{new Date(instance.dueAt).toLocaleDateString()} · {instance.locationText}</div>
                    </div>
                    <Badge variant="outline">{instance.workOrderId ? "linked" : instance.status}</Badge>
                  </div>
                </div>
              ))}
              {!isLoading && (data?.dueInstances ?? []).length === 0 ? <div className="text-muted-foreground">No due maintenance instances.</div> : null}
            </CardContent>
          </Card>
        )}
      </div>

      {isMobile ? (
        <MobileSectionShell
          eyebrow="Audit"
          title="Operations Audit Trail"
          summary="Recent operational actions remain readable on phones without forcing a dense table or split pane."
        >
          <div className="space-y-3 text-sm">
            {isLoading ? (
              <>
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </>
            ) : (data?.recentAudit ?? []).map((entry) => (
              <div key={entry.id} className="rounded border p-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                  <div className="min-w-0">
                    <div className="font-medium">{entry.entityType}</div>
                    <div className="text-muted-foreground">{entry.action} · {entry.actorEmail || "system"}</div>
                  </div>
                  <div className="text-xs text-muted-foreground">{new Date(entry.createdAt).toLocaleString()}</div>
                </div>
              </div>
            ))}
            {!isLoading && (data?.recentAudit ?? []).length === 0 ? <div className="text-muted-foreground">No operations audit entries yet.</div> : null}
          </div>
        </MobileSectionShell>
      ) : (
        <Card>
          <CardHeader><CardTitle className="text-base">Operations Audit Trail</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            {isLoading ? (
              <>
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </>
            ) : (data?.recentAudit ?? []).map((entry) => (
              <div key={entry.id} className="rounded border p-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                  <div className="min-w-0">
                    <div className="font-medium">{entry.entityType}</div>
                    <div className="text-muted-foreground">{entry.action} · {entry.actorEmail || "system"}</div>
                  </div>
                  <div className="text-xs text-muted-foreground">{new Date(entry.createdAt).toLocaleString()}</div>
                </div>
              </div>
            ))}
            {!isLoading && (data?.recentAudit ?? []).length === 0 ? <div className="text-muted-foreground">No operations audit entries yet.</div> : null}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
