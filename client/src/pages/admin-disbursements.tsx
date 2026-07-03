// zone: Financials / Platform
// persona: Platform Admin, Board Officer, Manager
//
// /app/admin/disbursements — Disbursement dual-approval (maker-checker) queue.
//
// HOA Remediation Phase 2 — segregation of duties on money-OUT (the #1 HOA
// embezzlement control). What this page does, plain-English:
//   A board officer / manager records a money-OUT request (a payment to a
//   vendor). Before it can be marked paid, a DIFFERENT authorized admin must
//   approve it. The creator can NEVER approve their own request — the Approve
//   button is disabled for the person who created it, AND the server refuses
//   it even if the button is bypassed (server-side maker≠checker enforcement
//   in server/services/disbursement-service.ts).
//
// Server endpoints consumed:
//   GET  /api/admin/disbursements?associationId=       — the queue
//   POST /api/admin/disbursements                       — create (maker)
//   POST /api/admin/disbursements/:id/approve           — approve (checker ≠ maker)
//   POST /api/admin/disbursements/:id/reject            — reject  (checker ≠ maker)
//   POST /api/admin/disbursements/:id/pay               — approved → paid
//
// Cross-link: server/routes/admin-disbursements.ts.

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useActiveAssociation } from "@/hooks/use-active-association";
import { WorkspacePageHeader } from "@/components/workspace-page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckCircle2, XCircle, Banknote, Building2 } from "lucide-react";
import type { Disbursement, DisbursementStatus } from "@shared/schema";

// The write roles that may create/approve/reject/pay (mirrors the server gate).
const WRITE_ROLES = ["platform-admin", "board-officer", "manager"];

interface AuthSession {
  authenticated: boolean;
  admin?: { id: string; email: string; role: string } | null;
}

function statusBadge(status: DisbursementStatus) {
  const map: Record<DisbursementStatus, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
    draft: { label: "Draft", variant: "outline" },
    "pending-approval": { label: "Pending approval", variant: "secondary" },
    approved: { label: "Approved", variant: "default" },
    paid: { label: "Paid", variant: "default" },
    rejected: { label: "Rejected", variant: "destructive" },
  };
  const { label, variant } = map[status] ?? { label: status, variant: "outline" as const };
  return <Badge variant={variant}>{label}</Badge>;
}

function dollars(cents: number): string {
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
}

export default function AdminDisbursementsPage() {
  const { activeAssociationId, activeAssociationName } = useActiveAssociation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: session } = useQuery<AuthSession | null>({
    queryKey: ["/api/auth/me", "session"],
    queryFn: async () => {
      const res = await fetch("/api/auth/me", { credentials: "include" });
      if (res.status === 401) return null;
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
  });
  const myAdminId = session?.admin?.id ?? null;
  const myRole = session?.admin?.role ?? null;
  const canWrite = myRole ? WRITE_ROLES.includes(myRole) : false;

  const [vendorName, setVendorName] = useState("");
  const [amountDollars, setAmountDollars] = useState("");
  const [memo, setMemo] = useState("");

  const listKey = ["/api/admin/disbursements", activeAssociationId];
  const { data: disbursements, isLoading } = useQuery<Disbursement[]>({
    queryKey: listKey,
    queryFn: async () => {
      const res = await apiRequest(
        "GET",
        `/api/admin/disbursements?associationId=${activeAssociationId}`,
      );
      const body = await res.json();
      return body.disbursements ?? [];
    },
    enabled: Boolean(activeAssociationId),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: listKey });

  const createMutation = useMutation({
    mutationFn: async () => {
      const cents = Math.round(Number(amountDollars.replace(/[$,]/g, "")) * 100);
      const res = await apiRequest("POST", "/api/admin/disbursements", {
        associationId: activeAssociationId,
        vendorName: vendorName.trim(),
        amountCents: cents,
        memo: memo.trim() || null,
        submitForApproval: true,
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Disbursement submitted", description: "Awaiting approval by a different admin." });
      setVendorName("");
      setAmountDollars("");
      setMemo("");
      invalidate();
    },
    onError: (err: any) =>
      toast({ title: "Could not create", description: err.message, variant: "destructive" }),
  });

  const actMutation = useMutation({
    mutationFn: async (params: { id: string; action: "approve" | "reject" | "pay"; reason?: string }) => {
      const res = await apiRequest(
        "POST",
        `/api/admin/disbursements/${params.id}/${params.action}`,
        { associationId: activeAssociationId, reason: params.reason },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Failed to ${params.action}`);
      }
      return res.json();
    },
    onSuccess: (_data, vars) => {
      toast({ title: `Disbursement ${vars.action === "pay" ? "marked paid" : vars.action + "d"}` });
      invalidate();
    },
    onError: (err: any) =>
      toast({ title: "Action failed", description: err.message, variant: "destructive" }),
  });

  const rows = disbursements ?? [];

  return (
    <div className="space-y-6">
      <WorkspacePageHeader
        title="Disbursement approvals"
        summary="Dual-approval (maker-checker) on money-out. A payment must be approved by a different admin than the one who created it."
      />

      {activeAssociationName && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Building2 className="h-4 w-4" />
          {activeAssociationName}
        </div>
      )}

      {canWrite && (
        <Card>
          <CardHeader>
            <CardTitle>New disbursement request</CardTitle>
            <CardDescription>
              You are the <strong>maker</strong>. A different authorized admin (the{" "}
              <strong>checker</strong>) must approve this before it can be paid — you cannot
              approve your own request.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-1">
                <Label htmlFor="vendorName">Payee / vendor</Label>
                <Input
                  id="vendorName"
                  value={vendorName}
                  onChange={(e) => setVendorName(e.target.value)}
                  placeholder="Acme Landscaping"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="amount">Amount (USD)</Label>
                <Input
                  id="amount"
                  value={amountDollars}
                  onChange={(e) => setAmountDollars(e.target.value)}
                  placeholder="1,250.00"
                  inputMode="decimal"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="memo">Memo</Label>
                <Input
                  id="memo"
                  value={memo}
                  onChange={(e) => setMemo(e.target.value)}
                  placeholder="June grounds maintenance"
                />
              </div>
            </div>
            <Button
              onClick={() => createMutation.mutate()}
              disabled={
                createMutation.isPending ||
                !vendorName.trim() ||
                !amountDollars.trim() ||
                Number(amountDollars.replace(/[$,]/g, "")) <= 0
              }
            >
              Submit for approval
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Approval queue</CardTitle>
          <CardDescription>All money-out requests for this association, newest first.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No disbursements yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Payee</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created by (maker)</TableHead>
                  <TableHead>Approved by (checker)</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((d) => {
                  const isMine = myAdminId != null && d.createdByAdminUserId === myAdminId;
                  const isPending = d.status === "pending-approval";
                  const isApproved = d.status === "approved";
                  return (
                    <TableRow key={d.id}>
                      <TableCell className="font-medium">{d.vendorName}</TableCell>
                      <TableCell>{dollars(d.amountCents)}</TableCell>
                      <TableCell>{statusBadge(d.status)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{d.createdByEmail}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {d.approvedByEmail ?? "—"}
                      </TableCell>
                      <TableCell className="text-right space-x-2">
                        {canWrite && isPending && (
                          <>
                            <Button
                              size="sm"
                              variant="default"
                              disabled={isMine || actMutation.isPending}
                              title={
                                isMine
                                  ? "You created this request — a different admin must approve it (segregation of duties)."
                                  : "Approve this disbursement"
                              }
                              onClick={() => actMutation.mutate({ id: d.id, action: "approve" })}
                            >
                              <CheckCircle2 className="h-4 w-4 mr-1" />
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              disabled={isMine || actMutation.isPending}
                              title={
                                isMine
                                  ? "You created this request — a different admin must review it."
                                  : "Reject this disbursement"
                              }
                              onClick={() =>
                                actMutation.mutate({
                                  id: d.id,
                                  action: "reject",
                                  reason: "Rejected by reviewer",
                                })
                              }
                            >
                              <XCircle className="h-4 w-4 mr-1" />
                              Reject
                            </Button>
                          </>
                        )}
                        {canWrite && isApproved && (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={actMutation.isPending}
                            onClick={() => actMutation.mutate({ id: d.id, action: "pay" })}
                          >
                            <Banknote className="h-4 w-4 mr-1" />
                            Mark paid
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
