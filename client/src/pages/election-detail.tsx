import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import type { Election, ElectionOption } from "@shared/schema";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import {
  Vote, ArrowLeft, Pencil, XCircle, Trash2, Clock, CheckCircle, BarChart2,
  Users, FileText, Download, Search, AlertTriangle, Mail, RefreshCw, Printer,
  ThumbsUp, ThumbsDown,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie,
} from "recharts";

type AdminRole = "platform-admin" | "board-officer" | "assisted-board" | "pm-assistant" | "manager" | "viewer";
type AuthSession = { authenticated: boolean; admin?: { role: AdminRole } | null };

type TokenDetail = {
  id: string;
  token: string;
  personId: string | null;
  unitId: string | null;
  status: string;
  sentAt: string | null;
  castAt: string | null;
  voterName: string;
  unitNumber: string;
  confirmationRef: string | null;
};

type TallyData = {
  electionId: string;
  eligibleCount: number;
  castCount: number;
  participationPercent: number;
  quorumPercent: number;
  quorumMet: boolean;
  optionTallies: Array<{ optionId: string; label: string; votes: number; percent: number }>;
  isCertified: boolean;
  certifiedAt: string | null;
};

type NominationDetail = {
  id: string;
  optionId: string;
  name: string;
  bio: string | null;
  nominationStatement: string | null;
  status: "pending" | "approved" | "rejected";
};

const CHART_COLORS = ["#6366f1", "#22c55e", "#f59e0b", "#ef4444", "#06b6d4", "#8b5cf6", "#ec4899", "#14b8a6"];

function statusBadge(status: string) {
  const colors: Record<string, string> = {
    draft: "bg-gray-100 text-gray-700",
    open: "bg-green-100 text-green-700",
    closed: "bg-yellow-100 text-yellow-700",
    certified: "bg-blue-100 text-blue-700",
    cancelled: "bg-red-100 text-red-700",
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${colors[status] ?? "bg-gray-100 text-gray-700"}`}>
      {status}
    </span>
  );
}

function voteTypeLabel(t: string) {
  return (
    { "board-election": "Board Election", resolution: "Resolution", "community-referendum": "Community Referendum", "amendment-ratification": "Amendment Ratification" }[t] ?? t
  );
}

function votingRuleLabel(r: string) {
  return (
    { "unit-weighted": "Unit-weighted", "person-weighted": "Person-weighted", "board-only": "Board only" }[r] ?? r
  );
}

function tokenStatusBadge(status: string) {
  const colors: Record<string, string> = {
    pending: "bg-yellow-100 text-yellow-700",
    cast: "bg-green-100 text-green-700",
    "consumed-by-proxy": "bg-blue-100 text-blue-700",
    revoked: "bg-red-100 text-red-700",
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${colors[status] ?? "bg-gray-100 text-gray-700"}`}>
      {status}
    </span>
  );
}

const editSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  opensAt: z.string().optional(),
  closesAt: z.string().optional(),
  quorumPercent: z.coerce.number().min(0).max(100),
  resultVisibility: z.enum(["public", "admin-only"]),
  isSecretBallot: z.coerce.number().int().min(0).max(1),
});

function EditElectionDialog({ election, onUpdated }: { election: Election; onUpdated: () => void }) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const isDraft = election.status === "draft";

  const form = useForm<z.infer<typeof editSchema>>({
    resolver: zodResolver(editSchema),
    defaultValues: {
      title: election.title,
      description: election.description ?? "",
      opensAt: election.opensAt ? new Date(election.opensAt).toISOString().slice(0, 16) : "",
      closesAt: election.closesAt ? new Date(election.closesAt).toISOString().slice(0, 16) : "",
      quorumPercent: election.quorumPercent,
      resultVisibility: election.resultVisibility,
      isSecretBallot: election.isSecretBallot,
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: z.infer<typeof editSchema>) => {
      const payload: Record<string, unknown> = {};
      if (isDraft) {
        payload.title = data.title;
        payload.description = data.description || null;
        payload.opensAt = data.opensAt ? new Date(data.opensAt).toISOString() : null;
        payload.closesAt = data.closesAt ? new Date(data.closesAt).toISOString() : null;
        payload.quorumPercent = data.quorumPercent;
        payload.resultVisibility = data.resultVisibility;
        payload.isSecretBallot = data.isSecretBallot;
      } else {
        payload.closesAt = data.closesAt ? new Date(data.closesAt).toISOString() : null;
        payload.description = data.description || null;
      }
      return apiRequest("PATCH", `/api/elections/${election.id}`, payload).then((r) => r.json());
    },
    onSuccess: () => {
      onUpdated();
      setOpen(false);
      toast({ title: "Election updated" });
    },
    onError: (err: Error) => toast({ title: "Update failed", description: err.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Pencil className="mr-1.5 h-3.5 w-3.5" />
          Edit
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Election</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((v) => updateMutation.mutate(v))} className="space-y-4">
            {isDraft && (
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Title</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl><Textarea rows={3} {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {isDraft && (
              <FormField
                control={form.control}
                name="opensAt"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Opens At</FormLabel>
                    <FormControl><Input type="datetime-local" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
            <FormField
              control={form.control}
              name="closesAt"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Closes At</FormLabel>
                  <FormControl><Input type="datetime-local" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {isDraft && (
              <>
                <FormField
                  control={form.control}
                  name="quorumPercent"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Quorum % Required</FormLabel>
                      <FormControl><Input type="number" min="0" max="100" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="resultVisibility"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Result Visibility</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="public">Public (owners can see)</SelectItem>
                          <SelectItem value="admin-only">Admin only</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="isSecretBallot"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Ballot Type</FormLabel>
                      <Select onValueChange={(v) => field.onChange(Number(v))} value={String(field.value)}>
                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="0">Standard (choices recorded)</SelectItem>
                          <SelectItem value="1">Secret ballot (choices anonymized)</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" type="button" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={updateMutation.isPending}>
                {updateMutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function CancelElectionDialog({ election, onCancelled }: { election: Election; onCancelled: () => void }) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();

  const cancelMutation = useMutation({
    mutationFn: () =>
      apiRequest("PATCH", `/api/elections/${election.id}`, { status: "cancelled" }).then((r) => r.json()),
    onSuccess: () => {
      onCancelled();
      setOpen(false);
      toast({ title: "Election cancelled" });
    },
    onError: (err: Error) => toast({ title: "Cancel failed", description: err.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="text-destructive border-destructive/30 hover:bg-destructive/10">
          <XCircle className="mr-1.5 h-3.5 w-3.5" />
          Cancel Election
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cancel Election</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <p>Are you sure you want to cancel <strong>{election.title}</strong>?</p>
          {election.status === "open" && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>This election is currently open. Cancelling it will revoke all outstanding ballot tokens. Votes already cast will be preserved for audit purposes.</span>
            </div>
          )}
          <p className="text-muted-foreground">This action cannot be undone.</p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Keep Election</Button>
          <Button
            variant="destructive"
            onClick={() => cancelMutation.mutate()}
            disabled={cancelMutation.isPending}
          >
            {cancelMutation.isPending ? "Cancelling..." : "Yes, Cancel Election"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DeleteElectionDialog({ election, onDeleted }: { election: Election; onDeleted: () => void }) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();

  const deleteMutation = useMutation({
    mutationFn: () => apiRequest("DELETE", `/api/elections/${election.id}`).then((r) => r.json()),
    onSuccess: () => {
      onDeleted();
      setOpen(false);
      toast({ title: "Election deleted" });
    },
    onError: (err: Error) => toast({ title: "Delete failed", description: err.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="text-destructive border-destructive/30 hover:bg-destructive/10">
          <Trash2 className="mr-1.5 h-3.5 w-3.5" />
          Delete
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Election</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <p>Are you sure you want to permanently delete <strong>{election.title}</strong>?</p>
          <p className="text-muted-foreground">This will remove the election, all ballot options, tokens, and proxy records. This action cannot be undone.</p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Keep</Button>
          <Button
            variant="destructive"
            onClick={() => deleteMutation.mutate()}
            disabled={deleteMutation.isPending}
          >
            {deleteMutation.isPending ? "Deleting..." : "Yes, Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function VoterTokenTable({ electionId, proxies = [] }: { electionId: string; proxies?: any[] }) {
  const [search, setSearch] = useState("");
  const { toast } = useToast();

  const resendMutation = useMutation({
    mutationFn: (tokenId: string) =>
      apiRequest("POST", `/api/elections/${electionId}/tokens/${tokenId}/resend`).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/elections/tokens-detail", electionId] });
      toast({ title: "Ballot resent" });
    },
    onError: (err: Error) => toast({ title: "Resend failed", description: err.message, variant: "destructive" }),
  });

  const { data: tokens = [], isLoading } = useQuery<TokenDetail[]>({
    queryKey: ["/api/elections/tokens-detail", electionId],
    queryFn: () => apiRequest("GET", `/api/elections/${electionId}/tokens-detail`).then((r) => r.json()),
  });

  const filtered = search
    ? tokens.filter(
        (t) =>
          t.voterName.toLowerCase().includes(search.toLowerCase()) ||
          t.unitNumber.toLowerCase().includes(search.toLowerCase()) ||
          t.status.toLowerCase().includes(search.toLowerCase()) ||
          (t.confirmationRef && t.confirmationRef.toLowerCase().includes(search.toLowerCase())),
      )
    : tokens;

  const pendingCount = tokens.filter((t) => t.status === "pending").length;
  const castCount = tokens.filter((t) => t.status === "cast").length;
  const proxyCount = tokens.filter((t) => t.status === "consumed-by-proxy").length;
  const revokedCount = tokens.filter((t) => t.status === "revoked").length;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <CardTitle className="text-sm font-medium">Voter Tokens ({tokens.length})</CardTitle>
          <div className="flex items-center gap-2 text-xs">
            <Badge variant="secondary">{pendingCount} pending</Badge>
            <Badge variant="secondary" className="bg-green-50 text-green-700">{castCount} cast</Badge>
            {proxyCount > 0 && <Badge variant="secondary" className="bg-blue-50 text-blue-700">{proxyCount} proxy</Badge>}
            {revokedCount > 0 && <Badge variant="secondary" className="bg-red-50 text-red-700">{revokedCount} revoked</Badge>}
          </div>
        </div>
        <div className="relative mt-2">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search voters, units, or confirmation..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-9 text-sm"
          />
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="py-8 text-center text-sm text-muted-foreground">Loading tokens...</div>
        ) : filtered.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            {tokens.length === 0 ? "No tokens generated yet." : "No matching tokens."}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Voter</TableHead>
                <TableHead>Unit</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Proxy</TableHead>
                <TableHead>Cast At</TableHead>
                <TableHead>Confirmation</TableHead>
                <TableHead>Delivered</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((token) => (
                <TableRow key={token.id}>
                  <TableCell className="text-sm font-medium">{token.voterName}</TableCell>
                  <TableCell className="text-sm">{token.unitNumber}</TableCell>
                  <TableCell>{tokenStatusBadge(token.status)}</TableCell>
                  <TableCell className="text-xs">
                    {token.status === "consumed-by-proxy" && token.personId ? (
                      (() => {
                        const proxy = proxies.find((p: any) => p.ownerPersonId === token.personId && !p.revokedAt);
                        return proxy ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-blue-700 text-xs font-medium">
                            <Users className="h-3 w-3" />
                            {proxy.proxyName || proxy.proxyPersonId}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">--</span>
                        );
                      })()
                    ) : (
                      <span className="text-muted-foreground">--</span>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {token.castAt ? new Date(token.castAt).toLocaleString() : "—"}
                  </TableCell>
                  <TableCell className="text-xs font-mono">
                    {token.confirmationRef ?? "—"}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {token.sentAt ? new Date(token.sentAt).toLocaleString() : "—"}
                  </TableCell>
                  <TableCell>
                    {token.status === "pending" && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2 text-xs"
                        disabled={resendMutation.isPending}
                        onClick={() => resendMutation.mutate(token.id)}
                      >
                        <RefreshCw className="mr-1 h-3 w-3" />
                        Resend
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

function NominationsSection({ electionId }: { electionId: string }) {
  const { toast } = useToast();

  const { data: nominations = [], isLoading } = useQuery<NominationDetail[]>({
    queryKey: ["/api/elections/nominations", electionId],
    queryFn: () => apiRequest("GET", `/api/elections/${electionId}/nominations`).then((r) => r.json()),
  });

  const approveMutation = useMutation({
    mutationFn: (optionId: string) =>
      apiRequest("POST", `/api/elections/${electionId}/nominations/${optionId}/approve`).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/elections/nominations", electionId] });
      queryClient.invalidateQueries({ queryKey: ["/api/elections/options", electionId] });
      toast({ title: "Nomination approved" });
    },
    onError: (err: Error) => toast({ title: "Approve failed", description: err.message, variant: "destructive" }),
  });

  const rejectMutation = useMutation({
    mutationFn: (optionId: string) =>
      apiRequest("POST", `/api/elections/${electionId}/nominations/${optionId}/reject`).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/elections/nominations", electionId] });
      toast({ title: "Nomination rejected" });
    },
    onError: (err: Error) => toast({ title: "Reject failed", description: err.message, variant: "destructive" }),
  });

  const pendingNominations = nominations.filter((n) => n.status === "pending");

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Users className="h-4 w-4" />
          Nominations ({nominations.length})
          {pendingNominations.length > 0 && (
            <Badge variant="secondary" className="bg-yellow-50 text-yellow-700 ml-1">
              {pendingNominations.length} pending
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="py-4 text-center text-sm text-muted-foreground">Loading nominations...</div>
        ) : nominations.length === 0 ? (
          <div className="py-4 text-center text-sm text-muted-foreground">No nominations submitted.</div>
        ) : (
          <div className="space-y-3">
            {nominations.map((nom) => (
              <div key={nom.id} className="rounded border px-3 py-2.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium">{nom.name}</span>
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                        nom.status === "pending"
                          ? "bg-yellow-100 text-yellow-700"
                          : nom.status === "approved"
                          ? "bg-green-100 text-green-700"
                          : "bg-red-100 text-red-700"
                      }`}>
                        {nom.status}
                      </span>
                    </div>
                    {nom.bio && (
                      <div className="text-xs text-muted-foreground line-clamp-2 mb-1">{nom.bio}</div>
                    )}
                    {nom.nominationStatement && (
                      <div className="text-xs text-muted-foreground italic line-clamp-2">
                        "{nom.nominationStatement}"
                      </div>
                    )}
                  </div>
                  {nom.status === "pending" && (
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2 text-xs text-green-700 hover:text-green-800 hover:bg-green-50"
                        disabled={approveMutation.isPending}
                        onClick={() => approveMutation.mutate(nom.optionId)}
                      >
                        <ThumbsUp className="mr-1 h-3 w-3" />
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2 text-xs text-red-700 hover:text-red-800 hover:bg-red-50"
                        disabled={rejectMutation.isPending}
                        onClick={() => rejectMutation.mutate(nom.optionId)}
                      >
                        <ThumbsDown className="mr-1 h-3 w-3" />
                        Reject
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function ElectionDetailPage({ id }: { id: string }) {
  useDocumentTitle("Election Details");
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const { data: session } = useQuery<AuthSession>({
    queryKey: ["/api/auth/session"],
    queryFn: () => apiRequest("GET", "/api/auth/session").then((r) => r.json()),
  });
  const adminRole: AdminRole = (session?.admin?.role as AdminRole) ?? "viewer";

  const { data: election, isLoading, refetch } = useQuery<Election>({
    queryKey: ["/api/elections", id],
    queryFn: () => apiRequest("GET", `/api/elections/${id}`).then((r) => r.json()),
  });

  const { data: options = [] } = useQuery<ElectionOption[]>({
    queryKey: ["/api/elections/options", id],
    queryFn: () => apiRequest("GET", `/api/elections/${id}/options`).then((r) => r.json()),
    enabled: !!election,
  });

  const { data: tally } = useQuery<TallyData>({
    queryKey: ["/api/elections/tally", id],
    queryFn: () => apiRequest("GET", `/api/elections/${id}/tally`).then((r) => r.json()),
    enabled: !!election,
  });

  const { data: proxies = [] } = useQuery<any[]>({
    queryKey: ["/api/elections/proxies", id],
    queryFn: () => apiRequest("GET", `/api/elections/${id}/proxies`).then((r) => r.json()),
    enabled: !!election,
  });

  const generateTokensMutation = useMutation({
    mutationFn: () =>
      apiRequest("POST", `/api/elections/${id}/generate-tokens`).then((r) => r.json()),
    onSuccess: (result) => {
      invalidateAll();
      if (result.warning) {
        toast({ title: "Warning", description: result.warning, variant: "destructive" });
      } else {
        toast({ title: "Ballot tokens generated", description: `${result.created} new tokens created.` });
      }
    },
    onError: (err: Error) => toast({ title: "Failed", description: err.message, variant: "destructive" }),
  });

  const updateStatusMutation = useMutation({
    mutationFn: (status: string) =>
      apiRequest("PATCH", `/api/elections/${id}`, { status }).then((r) => r.json()),
    onSuccess: () => {
      invalidateAll();
      toast({ title: "Election status updated" });
    },
    onError: (err: Error) => toast({ title: "Failed", description: err.message, variant: "destructive" }),
  });

  const certifyMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/elections/${id}/certify`).then((r) => r.json()),
    onSuccess: () => {
      invalidateAll();
      toast({ title: "Election certified", description: "Results are now locked and visible." });
    },
    onError: (err: Error) => toast({ title: "Certify failed", description: err.message, variant: "destructive" }),
  });

  const sendRemindersMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/elections/${id}/send-reminders`).then((r) => r.json()),
    onSuccess: (data: { sent: number; message: string }) => {
      toast({ title: "Reminders sent", description: data.message });
    },
    onError: (err: Error) => toast({ title: "Send reminders failed", description: err.message, variant: "destructive" }),
  });

  function invalidateAll() {
    queryClient.invalidateQueries({ queryKey: ["/api/elections", id] });
    queryClient.invalidateQueries({ queryKey: ["/api/elections/options", id] });
    queryClient.invalidateQueries({ queryKey: ["/api/elections/tally", id] });
    queryClient.invalidateQueries({ queryKey: ["/api/elections/proxies", id] });
    queryClient.invalidateQueries({ queryKey: ["/api/elections/tokens-detail", id] });
    queryClient.invalidateQueries({ queryKey: ["/api/elections"] });
  }

  if (isLoading) {
    return <div className="p-6 text-sm text-muted-foreground">Loading election...</div>;
  }

  if (!election) {
    return (
      <div className="p-6 text-center">
        <div className="text-sm text-muted-foreground mb-4">Election not found.</div>
        <Button variant="outline" size="sm" onClick={() => navigate("/app/governance/elections")}>
          <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
          Back to Elections
        </Button>
      </div>
    );
  }

  const canEdit = adminRole !== "viewer" && (election.status === "draft" || election.status === "open");
  const canCancel = adminRole !== "viewer" && (election.status === "draft" || election.status === "open");
  const canDelete = adminRole !== "viewer" && (election.status === "draft" || election.status === "cancelled");

  return (
    <div className="p-4 md:p-6 space-y-5">
      {/* Back nav */}
      <Button variant="ghost" size="sm" className="gap-1.5 -ml-2" onClick={() => navigate("/app/governance/elections")}>
        <ArrowLeft className="h-3.5 w-3.5" />
        Elections & Votes
      </Button>

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Vote className="h-5 w-5 text-primary" />
            <h1 className="text-lg font-semibold">{election.title}</h1>
            {statusBadge(election.status)}
          </div>
          <div className="flex items-center gap-3 text-sm text-muted-foreground flex-wrap">
            <span>{voteTypeLabel(election.voteType)}</span>
            <span>{votingRuleLabel(election.votingRule)}</span>
            {election.isSecretBallot ? <span className="text-amber-600">Secret ballot</span> : null}
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
            {election.opensAt && <span>Opens: {new Date(election.opensAt).toLocaleString()}</span>}
            {election.closesAt && <span>Closes: {new Date(election.closesAt).toLocaleString()}</span>}
            <span>Quorum: {election.quorumPercent}%</span>
            <span>Visibility: {election.resultVisibility}</span>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {canEdit && <EditElectionDialog election={election} onUpdated={invalidateAll} />}
          {canCancel && <CancelElectionDialog election={election} onCancelled={invalidateAll} />}
          {canDelete && (
            <DeleteElectionDialog
              election={election}
              onDeleted={() => navigate("/app/governance/elections")}
            />
          )}
        </div>
      </div>

      {/* Description */}
      {election.description && (
        <Card>
          <CardContent className="py-3 px-4 text-sm text-muted-foreground">{election.description}</CardContent>
        </Card>
      )}

      {/* Action buttons */}
      {adminRole !== "viewer" && (
        <div className="flex items-center gap-2 flex-wrap">
          {election.status === "draft" && (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={() => generateTokensMutation.mutate()}
                disabled={generateTokensMutation.isPending}
              >
                <Clock className="mr-1.5 h-3.5 w-3.5" />
                {generateTokensMutation.isPending ? "Generating..." : "Generate Tokens"}
              </Button>
              <Button
                size="sm"
                onClick={() => updateStatusMutation.mutate("open")}
                disabled={updateStatusMutation.isPending || options.length === 0}
                title={options.length === 0 ? "At least one ballot option is required before opening voting." : undefined}
              >
                Open Voting
              </Button>
            </>
          )}
          {election.status === "open" && (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={() => sendRemindersMutation.mutate()}
                disabled={sendRemindersMutation.isPending}
              >
                <Mail className="mr-1.5 h-3.5 w-3.5" />
                {sendRemindersMutation.isPending ? "Sending..." : "Send Reminders"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => updateStatusMutation.mutate("closed")}
                disabled={updateStatusMutation.isPending}
              >
                Close Voting
              </Button>
            </>
          )}
          {election.status === "closed" && tally && !tally.isCertified && (
            <Button
              size="sm"
              onClick={() => certifyMutation.mutate()}
              disabled={certifyMutation.isPending || !tally.quorumMet}
              title={!tally.quorumMet ? "Quorum not met" : undefined}
            >
              <CheckCircle className="mr-1.5 h-3.5 w-3.5" />
              {certifyMutation.isPending ? "Certifying..." : "Certify Results"}
            </Button>
          )}
          <a href={`/api/elections/${election.id}/result-report`} target="_blank" rel="noreferrer">
            <Button size="sm" variant="outline">
              <Download className="mr-1.5 h-3.5 w-3.5" />
              Result Report
            </Button>
          </a>
          <a href={`/api/elections/${election.id}/result-report`} target="_blank" rel="noreferrer">
            <Button size="sm" variant="outline">
              <Printer className="mr-1.5 h-3.5 w-3.5" />
              Print / Save as PDF
            </Button>
          </a>
          <a href={`/api/elections/${election.id}/eligibility-report`} target="_blank" rel="noreferrer">
            <Button size="sm" variant="outline">
              <Users className="mr-1.5 h-3.5 w-3.5" />
              Eligibility Report
            </Button>
          </a>
          {election.status === "certified" && (
            <a href={`/api/elections/${election.id}/audit-export`} target="_blank" rel="noreferrer">
              <Button size="sm" variant="outline">
                <CheckCircle className="mr-1.5 h-3.5 w-3.5" />
                Audit Export
              </Button>
            </a>
          )}
        </div>
      )}

      {/* Participation Metrics */}
      {tally && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card>
            <CardContent className="py-3 px-4 text-center">
              <div className="text-2xl font-bold">{tally.castCount}</div>
              <div className="text-xs text-muted-foreground">Votes Cast</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-3 px-4 text-center">
              <div className="text-2xl font-bold">{tally.eligibleCount}</div>
              <div className="text-xs text-muted-foreground">Eligible Voters</div>
            </CardContent>
          </Card>
          <Card className={tally.quorumMet ? "border-green-200 bg-green-50/50" : "border-yellow-200 bg-yellow-50/50"}>
            <CardContent className="py-3 px-4 text-center">
              <div className="text-2xl font-bold">{tally.participationPercent}%</div>
              <div className="text-xs text-muted-foreground">
                Participation {tally.quorumMet ? "(quorum met)" : "(below quorum)"}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-3 px-4 text-center">
              <div className="text-2xl font-bold">{tally.quorumPercent}%</div>
              <div className="text-xs text-muted-foreground">Quorum Required</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Results by Option */}
      {tally && !election.isSecretBallot && tally.optionTallies.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <BarChart2 className="h-4 w-4" />
              Results by Option
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Horizontal bar chart */}
              <div className="md:col-span-2">
                <ResponsiveContainer width="100%" height={Math.max(200, tally.optionTallies.length * 50)}>
                  <BarChart
                    data={tally.optionTallies.map((opt) => ({ name: opt.label, votes: opt.votes, percent: opt.percent }))}
                    layout="vertical"
                    margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                  >
                    <XAxis type="number" />
                    <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 12 }} />
                    <Tooltip
                      formatter={(value: number, _name: string, props: any) => [`${value} votes (${props.payload.percent}%)`, "Votes"]}
                    />
                    <Bar dataKey="votes" radius={[0, 4, 4, 0]}>
                      {tally.optionTallies.map((_opt, idx) => (
                        <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Participation donut chart */}
              <div className="flex flex-col items-center justify-center">
                <div className="text-xs font-medium text-muted-foreground mb-2">Participation Rate</div>
                <ResponsiveContainer width={160} height={160}>
                  <PieChart>
                    <Pie
                      data={[
                        { name: "Cast", value: tally.castCount },
                        { name: "Remaining", value: Math.max(0, tally.eligibleCount - tally.castCount) },
                      ]}
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={65}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      <Cell fill="#22c55e" />
                      <Cell fill="#e5e7eb" />
                    </Pie>
                    <Tooltip formatter={(value: number) => [value, ""]} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="text-lg font-bold">{tally.participationPercent}%</div>
                <div className="text-xs text-muted-foreground">{tally.castCount} of {tally.eligibleCount} voters</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {tally && election.isSecretBallot && (
        <Card>
          <CardContent className="py-3 px-4 text-xs text-muted-foreground">
            Secret ballot -- individual choices are anonymized. Only participation counts are shown.
          </CardContent>
        </Card>
      )}

      {tally && tally.isCertified && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
          Certified on {tally.certifiedAt ? new Date(tally.certifiedAt).toLocaleDateString() : "---"}
          {election.certifiedBy && <span> by {election.certifiedBy}</span>}
        </div>
      )}

      {/* Ballot Options */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Ballot Options ({options.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {options.length === 0 ? (
            <div className="py-4 text-center text-sm text-muted-foreground">No ballot options yet.</div>
          ) : (
            <div className="space-y-1">
              {options.map((opt) => (
                <div key={opt.id} className="flex items-center justify-between rounded border px-3 py-2 text-sm">
                  <div>
                    <div className="font-medium">{opt.label}</div>
                    {opt.description && <div className="text-xs text-muted-foreground">{opt.description}</div>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Nominations */}
      <NominationsSection electionId={id} />

      {/* Proxy Designations */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Users className="h-4 w-4" />
            Proxy Designations ({proxies.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {proxies.length === 0 ? (
            <div className="py-4 text-center text-sm text-muted-foreground px-4">No proxy designations.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Owner</TableHead>
                  <TableHead>Proxy</TableHead>
                  <TableHead>Designated</TableHead>
                  <TableHead>Revoked</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {proxies.map((p: any) => (
                  <TableRow key={p.id}>
                    <TableCell className="text-xs">{p.ownerName || p.ownerPersonId}</TableCell>
                    <TableCell className="text-xs">{p.proxyName || p.proxyPersonId}</TableCell>
                    <TableCell className="text-xs">{new Date(p.designatedAt).toLocaleDateString()}</TableCell>
                    <TableCell className="text-xs">{p.revokedAt ? new Date(p.revokedAt).toLocaleDateString() : "---"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Voter Token Table */}
      <VoterTokenTable electionId={id} proxies={proxies} />
    </div>
  );
}
