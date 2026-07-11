// zone: Operations
// persona: Manager, Board Officer, Assisted Board, PM Assistant
//
// CT CGS §47-260 — owner records-request workflow + statutory retention
// reference. (founder-os#8017)
//
// Admin surface to log an owner's §47-260(b) records request, see the
// statutory response-due date (receipt + 5 business days), and reference the
// §47-260(a) retention schedule + §47-260(c)/(d) withholding rules. Reuses the
// documents page UI patterns (Card / Table / Dialog / Form / react-query).
import { useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { RecordsRequest, Association } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// §47-260(a) — statutory retention schedule (display reference).
const RETENTION_SCHEDULE: Array<{ statute: string; record: string; period: string }> = [
  { statute: "§47-260(a)(5)", record: "Financial statements & tax returns", period: "3 years" },
  { statute: "§47-260(a)(11)", record: "Ballots, proxies & voting records", period: "1 year after the election" },
  { statute: "§47-260(a)(1)", record: "Receipts & expenditures", period: "No statutory destruction date" },
  { statute: "§47-260(a)(2)", record: "Meeting minutes", period: "No statutory destruction date" },
];

function statusBadgeVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "fulfilled":
      return "default";
    case "withheld":
    case "closed":
      return "secondary";
    case "received":
      return "outline";
    default:
      return "outline";
  }
}

function fmtDate(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  return Number.isNaN(d.getTime()) ? "—" : d.toISOString().slice(0, 10);
}

export default function RecordsRequestsPage() {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [requesterName, setRequesterName] = useState("");
  const [requesterEmail, setRequesterEmail] = useState("");
  const [recordsRequested, setRecordsRequested] = useState("");
  const [associationId, setAssociationId] = useState("");
  const [receivedAt, setReceivedAt] = useState(() => new Date().toISOString().slice(0, 10));

  const { data: requests, isLoading } = useQuery<RecordsRequest[]>({
    queryKey: ["/api/records-requests"],
  });
  const { data: associations } = useQuery<Association[]>({ queryKey: ["/api/associations"] });

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/records-requests", {
        associationId,
        requesterName,
        requesterEmail: requesterEmail || undefined,
        recordsRequested,
        receivedAt: new Date(receivedAt).toISOString(),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/records-requests"] });
      toast({ title: "Records request logged", description: "Response-due date computed per §47-260(b)." });
      setDialogOpen(false);
      setRequesterName("");
      setRequesterEmail("");
      setRecordsRequested("");
    },
    onError: () => {
      toast({ title: "Could not log request", variant: "destructive" });
    },
  });

  const sortedRequests = useMemo(
    () => (requests ?? []).slice().sort((a, b) => fmtDate(b.receivedAt).localeCompare(fmtDate(a.receivedAt))),
    [requests],
  );

  return (
    <div className="space-y-6 p-6" data-testid="records-requests-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Records Requests</h1>
          <p className="text-sm text-muted-foreground">
            Connecticut CGS §47-260 — owner records inspection & copies. Owners give 30 days&rsquo; notice; the
            association offers two examination dates within 5 business days (§47-260(b)).
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="new-records-request">Log records request</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Log a §47-260(b) records request</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium">Association</label>
                <select
                  className="mt-1 w-full rounded-md border bg-background p-2 text-sm"
                  value={associationId}
                  onChange={(e) => setAssociationId(e.target.value)}
                  data-testid="rr-association"
                >
                  <option value="">Select association…</option>
                  {(associations ?? []).map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium">Requesting owner / agent</label>
                <Input value={requesterName} onChange={(e) => setRequesterName(e.target.value)} data-testid="rr-name" />
              </div>
              <div>
                <label className="text-sm font-medium">Email (optional)</label>
                <Input value={requesterEmail} onChange={(e) => setRequesterEmail(e.target.value)} data-testid="rr-email" />
              </div>
              <div>
                <label className="text-sm font-medium">Records requested (reasonably identified)</label>
                <Input
                  value={recordsRequested}
                  onChange={(e) => setRecordsRequested(e.target.value)}
                  data-testid="rr-records"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Notice received on</label>
                <Input type="date" value={receivedAt} onChange={(e) => setReceivedAt(e.target.value)} data-testid="rr-received" />
              </div>
              <Button
                onClick={() => createMutation.mutate()}
                disabled={!associationId || !requesterName || !recordsRequested || createMutation.isPending}
                data-testid="rr-submit"
              >
                {createMutation.isPending ? "Saving…" : "Log request"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Requester</TableHead>
                <TableHead>Records requested</TableHead>
                <TableHead>Received</TableHead>
                <TableHead>Response due (§47-260(b))</TableHead>
                <TableHead>Copy fee</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={6}>Loading…</TableCell>
                </TableRow>
              )}
              {!isLoading && sortedRequests.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-muted-foreground">
                    No records requests logged yet.
                  </TableCell>
                </TableRow>
              )}
              {sortedRequests.map((r) => (
                <TableRow key={r.id} data-testid={`records-request-${r.id}`}>
                  <TableCell>{r.requesterName}</TableCell>
                  <TableCell className="max-w-xs truncate">{r.recordsRequested}</TableCell>
                  <TableCell>{fmtDate(r.receivedAt)}</TableCell>
                  <TableCell>{fmtDate(r.responseDueAt)}</TableCell>
                  <TableCell>{r.copyFeeCents != null ? `$${(r.copyFeeCents / 100).toFixed(2)}` : "—"}</TableCell>
                  <TableCell>
                    <Badge variant={statusBadgeVariant(r.status)}>{r.status}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-3 p-4">
          <h2 className="text-lg font-semibold">Statutory retention schedule (§47-260(a))</h2>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Statute</TableHead>
                <TableHead>Record type</TableHead>
                <TableHead>Retention</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {RETENTION_SCHEDULE.map((row) => (
                <TableRow key={row.statute}>
                  <TableCell className="font-mono text-xs">{row.statute}</TableCell>
                  <TableCell>{row.record}</TableCell>
                  <TableCell>{row.period}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <p className="text-xs text-muted-foreground">
            Withholding: §47-260(c) records (personnel/salary/medical, unredacted ballots/proxies) MUST be withheld;
            §47-260(d) records (active negotiation, litigation/mediation, attorney communications) MAY be withheld.
            §47-260(e) permits a reasonable copy & supervision fee.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
