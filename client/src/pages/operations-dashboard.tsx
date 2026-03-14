import { useQuery } from "@tanstack/react-query";
import type { InspectionRecord, MaintenanceScheduleInstance, WorkOrder } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { AuditLog } from "@shared/schema";

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
  const { data } = useQuery<OperationsDashboardData>({
    queryKey: ["/api/operations/dashboard"],
  });

  async function downloadReport(reportType: "vendors" | "work-orders" | "maintenance") {
    const res = await fetch(`/api/operations/reports/${reportType}`, {
      credentials: "include",
      headers: (() => {
        const apiKey = (window.localStorage.getItem("adminApiKey") || "").trim();
        const adminUserEmail = (window.localStorage.getItem("adminUserEmail") || "").trim().toLowerCase();
        const headers: Record<string, string> = {};
        if (apiKey && adminUserEmail) {
          headers["x-admin-api-key"] = apiKey;
          headers["x-admin-user-email"] = adminUserEmail;
        }
        return headers;
      })(),
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

  const totals = data?.totals ?? {
    openWorkOrders: 0,
    dueMaintenance: 0,
    openFindings: 0,
    activeVendors: 0,
    pendingRenewalVendors: 0,
    overdueInstances: 0,
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Operations Dashboard</h1>
        <p className="text-muted-foreground">Monitor open work, due preventive maintenance, vendor status, and inspection follow-up from one operations view.</p>
      </div>
      <div className="flex gap-2 flex-wrap">
        <Button variant="outline" onClick={() => downloadReport("vendors")}>Export Vendor Report</Button>
        <Button variant="outline" onClick={() => downloadReport("work-orders")}>Export Work Orders</Button>
        <Button variant="outline" onClick={() => downloadReport("maintenance")}>Export Maintenance</Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
        {[
          ["Open Work Orders", totals.openWorkOrders],
          ["Due Maintenance", totals.dueMaintenance],
          ["Open Findings", totals.openFindings],
          ["Active Vendors", totals.activeVendors],
          ["Renewal Risk", totals.pendingRenewalVendors],
          ["Overdue Instances", totals.overdueInstances],
        ].map(([label, value]) => (
          <Card key={label}>
            <CardContent className="pt-6">
              <div className="text-sm text-muted-foreground">{label}</div>
              <div className="text-2xl font-semibold">{value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader><CardTitle className="text-base">Work Order Aging</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex items-center justify-between"><span>Open / Assigned</span><Badge variant="outline">{data?.workOrderAging.open ?? 0}</Badge></div>
            <div className="flex items-center justify-between"><span>In Progress</span><Badge variant="outline">{data?.workOrderAging.inProgress ?? 0}</Badge></div>
            <div className="flex items-center justify-between"><span>Pending Review</span><Badge variant="outline">{data?.workOrderAging.pendingReview ?? 0}</Badge></div>
            <div className="flex items-center justify-between"><span>Closed</span><Badge variant="outline">{data?.workOrderAging.closed ?? 0}</Badge></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Vendor Status</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex items-center justify-between"><span>Active</span><Badge variant="outline">{data?.vendorStatus.active ?? 0}</Badge></div>
            <div className="flex items-center justify-between"><span>Inactive</span><Badge variant="outline">{data?.vendorStatus.inactive ?? 0}</Badge></div>
            <div className="flex items-center justify-between"><span>Pending Renewal</span><Badge variant="outline">{data?.vendorStatus.pendingRenewal ?? 0}</Badge></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Recent Inspections</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            {(data?.recentInspections ?? []).slice(0, 5).map((record) => (
              <div key={record.id} className="rounded border p-2">
                <div className="font-medium">{record.locationText}</div>
                <div className="text-muted-foreground">{record.inspectionType} · {record.inspectorName}</div>
              </div>
            ))}
            {(data?.recentInspections ?? []).length === 0 ? <div className="text-muted-foreground">No inspections yet.</div> : null}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Recent Work Orders</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            {(data?.recentWorkOrders ?? []).slice(0, 8).map((order) => (
              <div key={order.id} className="flex items-center justify-between rounded border p-2 gap-3">
                <div>
                  <div className="font-medium">{order.title}</div>
                  <div className="text-muted-foreground">{order.locationText || "No location"}</div>
                </div>
                <Badge variant="outline">{order.status}</Badge>
              </div>
            ))}
            {(data?.recentWorkOrders ?? []).length === 0 ? <div className="text-muted-foreground">No work orders yet.</div> : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Due Maintenance Instances</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            {(data?.dueInstances ?? []).slice(0, 8).map((instance) => (
              <div key={instance.id} className="flex items-center justify-between rounded border p-2 gap-3">
                <div>
                  <div className="font-medium">{instance.title}</div>
                  <div className="text-muted-foreground">{new Date(instance.dueAt).toLocaleDateString()} · {instance.locationText}</div>
                </div>
                <Badge variant="outline">{instance.workOrderId ? "linked" : instance.status}</Badge>
              </div>
            ))}
            {(data?.dueInstances ?? []).length === 0 ? <div className="text-muted-foreground">No due maintenance instances.</div> : null}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Operations Audit Trail</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm">
          {(data?.recentAudit ?? []).map((entry) => (
            <div key={entry.id} className="flex items-center justify-between gap-3 rounded border p-2">
              <div>
                <div className="font-medium">{entry.entityType}</div>
                <div className="text-muted-foreground">{entry.action} · {entry.actorEmail || "system"}</div>
              </div>
              <div className="text-xs text-muted-foreground">{new Date(entry.createdAt).toLocaleString()}</div>
            </div>
          ))}
          {(data?.recentAudit ?? []).length === 0 ? <div className="text-muted-foreground">No operations audit entries yet.</div> : null}
        </CardContent>
      </Card>
    </div>
  );
}
