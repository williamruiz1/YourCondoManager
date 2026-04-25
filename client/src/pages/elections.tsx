// zone: Governance
// persona: Manager, Board Officer, Assisted Board, PM Assistant
import { useState, useMemo } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import type { Election, ElectionOption, GovernanceMeeting } from "@shared/schema";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useActiveAssociation } from "@/hooks/use-active-association";
import { useIsMobile } from "@/hooks/use-mobile";
import { Vote, Plus, Download, FileText, Users, CheckCircle, Clock, BarChart2, Trash2, Search, AlertCircle } from "lucide-react";
import { WorkspacePageHeader } from "@/components/workspace-page-header";
import { t } from "@/i18n/use-strings";
import { boardGovernanceSubPages } from "@/lib/sub-page-nav";
import type { AdminRole } from "@shared/schema";

type AuthSession = { authenticated: boolean; admin?: { role: AdminRole } | null };

const electionSchema = z.object({
  associationId: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional(),
  voteType: z.enum(["board-election", "resolution", "community-referendum", "amendment-ratification"]),
  votingRule: z.enum(["unit-weighted", "person-weighted", "board-only"]),
  isSecretBallot: z.coerce.number().int().min(0).max(1).default(0),
  resultVisibility: z.enum(["public", "admin-only"]),
  opensAt: z.string().optional(),
  closesAt: z.string().optional(),
  quorumPercent: z.coerce.number().min(0).max(100).default(50),
  maxChoices: z.coerce.number().int().min(1).optional(),
  meetingId: z.string().optional(),
}).refine(
  (data) => {
    if (data.opensAt && data.closesAt) {
      return new Date(data.closesAt) > new Date(data.opensAt);
    }
    return true;
  },
  { message: "Closing date must be after opening date.", path: ["closesAt"] },
);

const optionSchema = z.object({
  label: z.string().min(1),
  description: z.string().optional(),
  orderIndex: z.coerce.number().int().min(0).default(0),
});

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

function ElectionTallyPanel({ election, adminRole }: { election: Election; adminRole: AdminRole }) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();

  const { data: tally } = useQuery({
    queryKey: ["/api/elections/tally", election.id],
    queryFn: () => apiRequest("GET", `/api/elections/${election.id}/tally`).then((r) => r.json()),
    enabled: open,
  });

  const certifyMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/elections/${election.id}/certify`).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/elections"] });
      toast({ title: "Election certified", description: "Results are now locked and visible." });
      setOpen(false);
    },
    onError: (err: Error) => toast({ title: "Certify failed", description: err.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="icon" variant="outline" title="View Tally" aria-label="View vote tally">
          <BarChart2 className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Live Tally — {election.title}</DialogTitle>
        </DialogHeader>
        {tally ? (
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg border p-3 text-center">
                <div className="text-2xl font-bold">{tally.castCount}</div>
                <div className="text-xs text-muted-foreground">Votes Cast</div>
              </div>
              <div className="rounded-lg border p-3 text-center">
                <div className="text-2xl font-bold">{tally.eligibleCount}</div>
                <div className="text-xs text-muted-foreground">Eligible</div>
              </div>
              <div className={`rounded-lg border p-3 text-center ${tally.quorumMet ? "border-green-200 bg-green-50" : "border-yellow-200 bg-yellow-50"}`}>
                <div className="text-2xl font-bold">{tally.participationPercent}%</div>
                <div className="text-xs text-muted-foreground">Participation {tally.quorumMet ? "(quorum met)" : "(below quorum)"}</div>
              </div>
            </div>

            {!election.isSecretBallot && tally.optionTallies?.length > 0 && (
              <div>
                <div className="font-medium mb-2">Results by Option</div>
                <div className="space-y-2">
                  {tally.optionTallies.map((opt: { optionId: string; label: string; votes: number; percent: number }) => (
                    <div key={opt.optionId}>
                      <div className="flex justify-between text-xs mb-0.5">
                        <span>{opt.label}</span>
                        <span>{opt.votes} votes ({opt.percent}%)</span>
                      </div>
                      <div className="h-2 rounded bg-muted overflow-hidden">
                        <div className="h-full bg-primary rounded" style={{ width: `${opt.percent}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {election.isSecretBallot && (
              <div className="rounded-lg border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                Secret ballot — individual choices are anonymized. Only participation counts are shown.
              </div>
            )}

            {tally.isCertified && (
              <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-800">
                Certified on {tally.certifiedAt ? new Date(tally.certifiedAt).toLocaleDateString() : "—"}
              </div>
            )}

            {!tally.isCertified && election.status === "closed" && adminRole !== "viewer" && (
              <Button
                className="w-full"
                onClick={() => certifyMutation.mutate()}
                disabled={certifyMutation.isPending || !tally.quorumMet}
                title={!tally.quorumMet ? "Quorum not met — cannot certify" : undefined}
              >
                {certifyMutation.isPending ? "Certifying…" : "Certify Results"}
              </Button>
            )}
          </div>
        ) : (
          <div className="py-6 text-center text-sm text-muted-foreground">Loading tally…</div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ElectionOptionsPanel({ election, adminRole }: { election: Election; adminRole: AdminRole }) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();

  const { data: options = [] } = useQuery<ElectionOption[]>({
    queryKey: ["/api/elections/options", election.id],
    queryFn: () => apiRequest("GET", `/api/elections/${election.id}/options`).then((r) => r.json()),
    enabled: open,
  });

  const form = useForm({ resolver: zodResolver(optionSchema), defaultValues: { label: "", description: "", orderIndex: options.length } });

  const addMutation = useMutation({
    mutationFn: (data: z.infer<typeof optionSchema>) =>
      apiRequest("POST", `/api/elections/${election.id}/options`, { ...data, electionId: election.id }).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/elections/options", election.id] });
      form.reset({ label: "", description: "", orderIndex: 0 });
      toast({ title: "Option added" });
    },
    onError: (err: Error) => toast({ title: "Failed", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (optionId: string) =>
      apiRequest("DELETE", `/api/elections/${election.id}/options/${optionId}`).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/elections/options", election.id] });
      toast({ title: "Option removed" });
    },
    onError: (err: Error) => toast({ title: "Failed", description: err.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="icon" variant="outline" title="Ballot Options" aria-label="Ballot options">
          <FileText className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Ballot Options — {election.title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {options.length === 0 ? (
            <div className="py-4 text-center text-sm text-muted-foreground">No options yet. Add candidates or choices below.</div>
          ) : (
            <div className="space-y-1">
              {options.map((opt) => (
                <div key={opt.id} className="flex items-center justify-between rounded border px-3 py-2 text-sm">
                  <div>
                    <div className="font-medium">{opt.label}</div>
                    {opt.description && <div className="text-xs text-muted-foreground">{opt.description}</div>}
                  </div>
                  {adminRole !== "viewer" && election.status === "draft" && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-destructive"
                      onClick={() => deleteMutation.mutate(opt.id)}
                      disabled={deleteMutation.isPending}
                      aria-label={`Delete ballot option ${opt.label}`}
                    >
                      <Trash2 aria-hidden="true" className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}

          {adminRole !== "viewer" && election.status === "draft" && (
            <Form {...form}>
              <form onSubmit={form.handleSubmit((v) => addMutation.mutate(v))} className="space-y-2 border-t pt-3">
                <FormField
                  control={form.control}
                  name="label"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Option / Candidate Name</FormLabel>
                      <FormControl><Input placeholder="e.g. Jane Smith" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description (optional)</FormLabel>
                      <FormControl><Input placeholder="Short description or bio" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" size="sm" disabled={addMutation.isPending}>
                  {addMutation.isPending ? "Adding…" : "Add Option"}
                </Button>
              </form>
            </Form>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ProxyManagementPanel({ election }: { election: Election }) {
  const [open, setOpen] = useState(false);
  const [ownerPersonId, setOwnerPersonId] = useState("");
  const [proxyPersonId, setProxyPersonId] = useState("");
  const { toast } = useToast();

  const { data: proxies = [] } = useQuery<any[]>({
    queryKey: ["/api/elections/proxies", election.id],
    queryFn: () => apiRequest("GET", `/api/elections/${election.id}/proxies`).then((r) => r.json()),
    enabled: open,
  });

  const { data: proxyDocs = [] } = useQuery<any[]>({
    queryKey: ["/api/elections/proxy-docs", election.id],
    queryFn: () => apiRequest("GET", `/api/elections/${election.id}/proxy-documents`).then((r) => r.json()),
    enabled: open,
  });

  const { data: personsList = [] } = useQuery<any[]>({
    queryKey: ["/api/persons", election.associationId],
    queryFn: () => apiRequest("GET", `/api/persons?associationId=${election.associationId}`).then((r) => r.json()),
    enabled: open,
  });

  const revokeMutation = useMutation({
    mutationFn: (proxyId: string) =>
      apiRequest("DELETE", `/api/elections/proxies/${proxyId}`).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/elections/proxies", election.id] });
      toast({ title: "Proxy revoked" });
    },
    onError: (err: Error) => toast({ title: "Failed", description: err.message, variant: "destructive" }),
  });

  const createProxyMutation = useMutation({
    mutationFn: (data: { ownerPersonId: string; proxyPersonId: string }) =>
      apiRequest("POST", `/api/elections/${election.id}/proxies`, data).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/elections/proxies", election.id] });
      setOwnerPersonId("");
      setProxyPersonId("");
      toast({ title: "Proxy designation created" });
    },
    onError: (err: Error) => toast({ title: "Failed", description: err.message, variant: "destructive" }),
  });

  const handleCreateProxy = () => {
    if (!ownerPersonId || !proxyPersonId) {
      toast({ title: "Please select both owner and proxy", variant: "destructive" });
      return;
    }
    if (ownerPersonId === proxyPersonId) {
      toast({ title: "Owner and proxy must be different persons", variant: "destructive" });
      return;
    }
    createProxyMutation.mutate({ ownerPersonId, proxyPersonId });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="icon" variant="outline" title="Proxy Management" aria-label="Proxy management">
          <Users className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[80vh] max-w-[calc(100vw-2rem)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Proxies — {election.title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 text-sm">
          {/* Create Proxy Form */}
          <div className="rounded border p-3 space-y-3">
            <div className="font-medium text-xs">Designate New Proxy</div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Owner (delegator)</label>
                <Select value={ownerPersonId} onValueChange={setOwnerPersonId}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Select owner..." />
                  </SelectTrigger>
                  <SelectContent>
                    {personsList.map((p: any) => (
                      <SelectItem key={p.id} value={p.id} className="text-xs">
                        {p.firstName} {p.lastName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Proxy (representative)</label>
                <Select value={proxyPersonId} onValueChange={setProxyPersonId}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Select proxy..." />
                  </SelectTrigger>
                  <SelectContent>
                    {personsList.map((p: any) => (
                      <SelectItem key={p.id} value={p.id} className="text-xs">
                        {p.firstName} {p.lastName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button
              size="sm"
              className="h-7 text-xs"
              onClick={handleCreateProxy}
              disabled={createProxyMutation.isPending || !ownerPersonId || !proxyPersonId}
            >
              {createProxyMutation.isPending ? "Creating..." : "Create Proxy Designation"}
            </Button>
          </div>

          <div>
            <div className="font-medium mb-2">Digital Proxy Designations ({proxies.length})</div>
            {proxies.length === 0 ? (
              <div className="text-muted-foreground text-xs">No digital proxies designated yet.</div>
            ) : (
              // Wave 23 a11y: aria-label names this proxies table.
              <Table aria-label="Election proxies">
                <TableHeader>
                  <TableRow>
                    <TableHead>Owner</TableHead>
                    <TableHead>Proxy</TableHead>
                    <TableHead>Designated</TableHead>
                    <TableHead>Revoked</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {proxies.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="text-xs">{p.ownerName || p.ownerPersonId}</TableCell>
                      <TableCell className="text-xs">{p.proxyName || p.proxyPersonId}</TableCell>
                      <TableCell className="text-xs">{new Date(p.designatedAt).toLocaleDateString()}</TableCell>
                      <TableCell className="text-xs">{p.revokedAt ? new Date(p.revokedAt).toLocaleDateString() : "—"}</TableCell>
                      <TableCell>
                        {!p.revokedAt && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-6 text-xs"
                            onClick={() => revokeMutation.mutate(p.id)}
                            disabled={revokeMutation.isPending}
                          >
                            Revoke
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>

          <div>
            <div className="font-medium mb-2">Proxy Documents ({proxyDocs.length})</div>
            {proxyDocs.length === 0 ? (
              <div className="text-muted-foreground text-xs">No proxy documents uploaded.</div>
            ) : (
              <div className="space-y-1">
                {proxyDocs.map((d) => (
                  <div key={d.id} className="flex items-center justify-between rounded border px-3 py-2 text-xs">
                    <div>
                      <div className="font-medium">{d.title}</div>
                      <div className="text-muted-foreground">{d.uploadedBy || "Unknown"} · {new Date(d.createdAt).toLocaleDateString()}</div>
                    </div>
                    <a href={d.fileUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline">View</a>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CreateElectionDialog({ associationId, onCreated, defaultMeetingId }: { associationId: string; onCreated: () => void; defaultMeetingId?: string }) {
  const [open, setOpen] = useState(false);
  const [meetingSearch, setMeetingSearch] = useState("");
  const { toast } = useToast();

  const { data: meetings = [] } = useQuery<GovernanceMeeting[]>({
    queryKey: ["/api/governance/meetings", associationId],
    queryFn: () => apiRequest("GET", `/api/governance/meetings?associationId=${associationId}`).then((r) => r.json()),
    enabled: open && !!associationId,
  });

  const filteredMeetings = useMemo(() => {
    if (!meetingSearch.trim()) return meetings;
    const q = meetingSearch.trim().toLowerCase();
    return meetings.filter((m) => m.title.toLowerCase().includes(q) || new Date(m.scheduledAt).toLocaleDateString().includes(q));
  }, [meetings, meetingSearch]);

  const form = useForm<z.infer<typeof electionSchema>>({
    resolver: zodResolver(electionSchema),
    defaultValues: {
      associationId,
      title: "",
      description: "",
      voteType: "resolution",
      votingRule: "unit-weighted",
      isSecretBallot: 0,
      resultVisibility: "public",
      quorumPercent: 50,
      opensAt: "",
      closesAt: "",
      meetingId: defaultMeetingId || "",
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: z.infer<typeof electionSchema>) =>
      apiRequest("POST", "/api/elections", {
        ...data,
        opensAt: data.opensAt ? new Date(data.opensAt).toISOString() : null,
        closesAt: data.closesAt ? new Date(data.closesAt).toISOString() : null,
        meetingId: data.meetingId || null,
        maxChoices: data.maxChoices || null,
      }).then((r) => r.json()),
    onSuccess: () => {
      onCreated();
      setOpen(false);
      form.reset();
      toast({ title: "Election created", description: "Add ballot options and generate tokens to proceed." });
    },
    onError: (err: Error) => toast({ title: "Failed to create election", description: err.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="mr-1.5 h-4 w-4" />
          Create Election or Vote
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-[calc(100vw-2rem)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create Election or Vote</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((v) => createMutation.mutate(v))} className="space-y-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
                  <FormControl><Input placeholder="2025 Board Election" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl><Textarea rows={3} placeholder="Describe the purpose of this election or vote…" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="voteType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Vote Type</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="board-election">Board Election</SelectItem>
                        <SelectItem value="resolution">Resolution</SelectItem>
                        <SelectItem value="community-referendum">Community Referendum</SelectItem>
                        <SelectItem value="amendment-ratification">Amendment Ratification</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="votingRule"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Voting Rule</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="unit-weighted">1 unit = 1 vote</SelectItem>
                        <SelectItem value="person-weighted">1 person = 1 vote</SelectItem>
                        <SelectItem value="board-only">Board members only</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
            </div>
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
                      <SelectItem value="1">Secret ballot (choices anonymized after submission)</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            {form.watch("voteType") === "board-election" && (
              <FormField
                control={form.control}
                name="maxChoices"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Max Choices (seats to fill)</FormLabel>
                    <FormControl><Input type="number" min="1" placeholder="e.g. 3" {...field} value={field.value ?? ""} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
            <FormField
              control={form.control}
              name="meetingId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Linked Meeting <span className="text-muted-foreground font-normal">(optional)</span></FormLabel>
                  <div className="space-y-1.5">
                    {meetings.length > 5 && (
                      <Input
                        placeholder="Search meetings..."
                        value={meetingSearch}
                        onChange={(e) => setMeetingSearch(e.target.value)}
                        className="h-8 text-xs"
                      />
                    )}
                    <Select
                      onValueChange={(v) => {
                        field.onChange(v === "__none__" ? "" : v);
                        // Auto-suggest dates aligned to selected meeting
                        if (v && v !== "__none__") {
                          const meeting = meetings.find((m) => m.id === v);
                          if (meeting) {
                            const meetingDate = new Date(meeting.scheduledAt);
                            const opensAt = form.getValues("opensAt");
                            const closesAt = form.getValues("closesAt");
                            if (!opensAt) {
                              // Suggest voting opens 7 days before meeting
                              const suggestedOpen = new Date(meetingDate.getTime() - 7 * 24 * 60 * 60 * 1000);
                              form.setValue("opensAt", suggestedOpen.toISOString().slice(0, 16));
                            }
                            if (!closesAt) {
                              // Suggest voting closes at meeting time
                              form.setValue("closesAt", meetingDate.toISOString().slice(0, 16));
                            }
                          }
                        }
                      }}
                      value={field.value || "__none__"}
                    >
                      <FormControl><SelectTrigger><SelectValue placeholder="No meeting linked" /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="__none__">No meeting linked</SelectItem>
                        {filteredMeetings.map((m) => (
                          <SelectItem key={m.id} value={m.id}>
                            {m.title} — {new Date(m.scheduledAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
              <Button className="w-full sm:w-auto" variant="outline" type="button" onClick={() => setOpen(false)}>Cancel</Button>
              <Button className="w-full sm:w-auto" type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? "Creating…" : "Create Election"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

const STATUS_TABS = ["all", "draft", "open", "closed", "certified", "cancelled"] as const;
type StatusTab = typeof STATUS_TABS[number];

export function ElectionsContent() {
  const { activeAssociationId } = useActiveAssociation();
  const isMobile = useIsMobile();
  const { toast } = useToast();
  const [, navigate] = useLocation();

  // Persist active tab in URL search params
  const urlParams = new URLSearchParams(window.location.search);
  const initialTab = (urlParams.get("status") as StatusTab) || "all";
  const urlMeetingId = urlParams.get("meetingId") || undefined;
  const [activeTab, setActiveTab] = useState<StatusTab>(STATUS_TABS.includes(initialTab as StatusTab) ? initialTab as StatusTab : "all");
  const [searchQuery, setSearchQuery] = useState("");

  const handleTabChange = (value: string) => {
    const tab = value as StatusTab;
    setActiveTab(tab);
    const params = new URLSearchParams(window.location.search);
    if (tab === "all") {
      params.delete("status");
    } else {
      params.set("status", tab);
    }
    const search = params.toString();
    window.history.replaceState(null, "", window.location.pathname + (search ? `?${search}` : ""));
  };

  const { data: session } = useQuery<AuthSession>({
    queryKey: ["/api/auth/session"],
    queryFn: () => apiRequest("GET", "/api/auth/session").then((r) => r.json()),
  });
  const adminRole: AdminRole = (session?.admin?.role as AdminRole) ?? "viewer";

  const { data: elections = [], refetch } = useQuery<Election[]>({
    queryKey: ["/api/elections", activeAssociationId],
    queryFn: () =>
      apiRequest("GET", `/api/elections${activeAssociationId ? `?associationId=${activeAssociationId}` : ""}`).then((r) => r.json()),
    enabled: !!activeAssociationId,
  });

  const { data: meetingsForLookup = [] } = useQuery<GovernanceMeeting[]>({
    queryKey: ["/api/governance/meetings", activeAssociationId],
    queryFn: () => apiRequest("GET", `/api/governance/meetings?associationId=${activeAssociationId}`).then((r) => r.json()),
    enabled: !!activeAssociationId,
  });
  const meetingNameMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const m of meetingsForLookup) {
      map.set(m.id, m.title);
    }
    return map;
  }, [meetingsForLookup]);

  // Client-side filtering by status tab and search query
  const filteredElections = useMemo(() => {
    let result = elections;
    if (activeTab !== "all") {
      result = result.filter((e) => e.status === activeTab);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter((e) => e.title.toLowerCase().includes(q));
    }
    return result;
  }, [elections, activeTab, searchQuery]);

  // Status counts for tab badges
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { all: elections.length, draft: 0, open: 0, closed: 0, certified: 0, cancelled: 0 };
    for (const e of elections) {
      if (counts[e.status] !== undefined) counts[e.status]++;
    }
    return counts;
  }, [elections]);

  const generateTokensMutation = useMutation({
    mutationFn: (electionId: string) =>
      apiRequest("POST", `/api/elections/${electionId}/generate-tokens`).then((r) => r.json()),
    onSuccess: (result, electionId) => {
      queryClient.invalidateQueries({ queryKey: ["/api/elections"] });
      if (result.warning) {
        toast({ title: "Warning", description: result.warning, variant: "destructive" });
      } else {
        toast({ title: "Ballot tokens generated", description: `${result.created} new tokens created.` });
      }
    },
    onError: (err: Error) => toast({ title: "Failed", description: err.message, variant: "destructive" }),
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      apiRequest("PATCH", `/api/elections/${id}`, { status }).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/elections"] });
      toast({ title: "Election status updated" });
    },
    onError: (err: Error) => toast({ title: "Failed", description: err.message, variant: "destructive" }),
  });

  if (!activeAssociationId) {
    return (
      <div className="text-sm text-muted-foreground">Select an association to manage elections.</div>
    );
  }

  return (
    <>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Vote className="h-5 w-5 text-primary" />
          <Badge variant="secondary">{elections.length}</Badge>
        </div>
        {adminRole !== "viewer" && (
          <CreateElectionDialog
            associationId={activeAssociationId}
            onCreated={() => refetch()}
            defaultMeetingId={urlMeetingId}
          />
        )}
      </div>

      {/* 5.4: Summary statistics bar */}
      {elections.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card>
            <CardContent className="py-3 px-4">
              <div className="text-2xl font-bold">{elections.length}</div>
              <div className="text-xs text-muted-foreground">Total Elections</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-3 px-4">
              <div className="text-2xl font-bold text-green-600">{statusCounts.open}</div>
              <div className="text-xs text-muted-foreground">Currently Open</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-3 px-4">
              <div className="text-2xl font-bold text-blue-600">{statusCounts.certified}</div>
              <div className="text-xs text-muted-foreground">Certified</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-3 px-4">
              <div className="text-2xl font-bold text-yellow-600">{statusCounts.closed}</div>
              <div className="text-xs text-muted-foreground">Pending Certification</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* 5.1: Status filter tabs */}
      {elections.length > 0 && (
        <Tabs value={activeTab} onValueChange={handleTabChange}>
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <TabsList className="flex-1 overflow-x-auto">
              {STATUS_TABS.map((tab) => (
                <TabsTrigger key={tab} value={tab} className="capitalize gap-1.5">
                  {tab}
                  <Badge variant="secondary" className="ml-1 h-5 min-w-[20px] px-1.5 text-[10px]">
                    {statusCounts[tab]}
                  </Badge>
                </TabsTrigger>
              ))}
            </TabsList>
            {/* 5.2: Search input */}
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search elections..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9"
              />
            </div>
          </div>
        </Tabs>
      )}

      {/* 5.3: Rich empty state when no elections exist at all */}
      {elections.length === 0 ? (
        <Card>
          <CardContent className="py-12 flex flex-col items-center text-center space-y-4">
            <div className="rounded-full bg-primary/10 p-4">
              <Vote className="h-10 w-10 text-primary" />
            </div>
            <div className="space-y-2 max-w-md">
              <h2 className="text-xl font-semibold">Get started with Elections & Votes</h2>
              <p className="text-sm text-muted-foreground">
                Run transparent, auditable elections and votes for your community.
                From board elections to amendment ratifications, manage the entire
                voting lifecycle with quorum tracking, proxy support, and certified results.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-left w-full max-w-sm">
              <div className="flex items-center gap-2 rounded-lg border px-3 py-2">
                <CheckCircle className="h-4 w-4 text-primary shrink-0" />
                <span>Board Election</span>
              </div>
              <div className="flex items-center gap-2 rounded-lg border px-3 py-2">
                <CheckCircle className="h-4 w-4 text-primary shrink-0" />
                <span>Resolution</span>
              </div>
              <div className="flex items-center gap-2 rounded-lg border px-3 py-2">
                <CheckCircle className="h-4 w-4 text-primary shrink-0" />
                <span>Community Referendum</span>
              </div>
              <div className="flex items-center gap-2 rounded-lg border px-3 py-2">
                <CheckCircle className="h-4 w-4 text-primary shrink-0" />
                <span>Amendment Ratification</span>
              </div>
            </div>
            {adminRole !== "viewer" && (
              <CreateElectionDialog
                associationId={activeAssociationId}
                onCreated={() => refetch()}
                defaultMeetingId={urlMeetingId}
              />
            )}
          </CardContent>
        </Card>
      ) : filteredElections.length === 0 ? (
        <Card>
          <CardContent className="py-12 flex flex-col items-center text-center space-y-2">
            <AlertCircle className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              No elections match your current filters.
            </p>
            <Button variant="outline" size="sm" onClick={() => { setActiveTab("all"); setSearchQuery(""); handleTabChange("all"); }}>
              Clear filters
            </Button>
          </CardContent>
        </Card>
      ) : isMobile ? (
        <div className="space-y-3">
          {filteredElections.map((election) => (
            <Card key={election.id} className="cursor-pointer hover:border-primary/30 transition-colors" onClick={() => navigate(`/app/governance/elections/${election.id}`)}>
              <CardContent className="py-3 px-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-medium text-sm">{election.title}</div>
                    <div className="text-xs text-muted-foreground">{voteTypeLabel(election.voteType)} · {votingRuleLabel(election.votingRule)}</div>
                    {election.meetingId && meetingNameMap.get(election.meetingId) && (
                      <div className="text-xs text-muted-foreground mt-0.5">Meeting: {meetingNameMap.get(election.meetingId)}</div>
                    )}
                  </div>
                  {statusBadge(election.status)}
                </div>
                {election.description && (
                  <div className="text-xs text-muted-foreground">{election.description}</div>
                )}
                <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
                  {election.opensAt && <span>Opens {new Date(election.opensAt).toLocaleDateString()}</span>}
                  {election.closesAt && <span>Closes {new Date(election.closesAt).toLocaleDateString()}</span>}
                  {election.isSecretBallot ? <span className="text-amber-600">Secret ballot</span> : null}
                  <span>Quorum: {election.quorumPercent}%</span>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <ElectionOptionsPanel election={election} adminRole={adminRole} />
                  <ProxyManagementPanel election={election} />
                  <ElectionTallyPanel election={election} adminRole={adminRole} />
                  {adminRole !== "viewer" && election.status === "draft" && (
                    <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => generateTokensMutation.mutate(election.id)} disabled={generateTokensMutation.isPending}>
                      Generate Tokens
                    </Button>
                  )}
                  {adminRole !== "viewer" && election.status === "draft" && (
                    <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => updateStatusMutation.mutate({ id: election.id, status: "open" })} disabled={updateStatusMutation.isPending} title="Requires at least one ballot option">
                      Open Voting
                    </Button>
                  )}
                  {adminRole !== "viewer" && election.status === "open" && (
                    <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => updateStatusMutation.mutate({ id: election.id, status: "closed" })} disabled={updateStatusMutation.isPending}>
                      Close Voting
                    </Button>
                  )}
                  <a href={`/api/elections/${election.id}/result-report`} target="_blank" rel="noreferrer">
                    <Button size="icon" variant="outline" className="h-8 w-8" title="Download Result Report" aria-label="Download result report">
                      <Download className="h-3.5 w-3.5" />
                    </Button>
                  </a>
                  {election.status === "certified" && (
                    <a href={`/api/elections/${election.id}/audit-export`} target="_blank" rel="noreferrer">
                      <Button size="icon" variant="outline" className="h-8 w-8" title="Audit Export" aria-label="Audit export">
                        <CheckCircle className="h-3.5 w-3.5" />
                      </Button>
                    </a>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            // Wave 23 a11y: aria-label names this elections list table.
            <Table aria-label="Elections and votes">
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Voting Rule</TableHead>
                  <TableHead>Opens / Closes</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Quorum</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredElections.map((election) => (
                  <TableRow key={election.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/app/governance/elections/${election.id}`)}>
                    <TableCell>
                      <div className="font-medium text-sm">{election.title}</div>
                      {election.isSecretBallot ? <div className="text-xs text-amber-600">Secret ballot</div> : null}
                      {election.meetingId && meetingNameMap.get(election.meetingId) && (
                        <div className="text-xs text-muted-foreground">Meeting: {meetingNameMap.get(election.meetingId)}</div>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">{voteTypeLabel(election.voteType)}</TableCell>
                    <TableCell className="text-sm">{votingRuleLabel(election.votingRule)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      <div>{election.opensAt ? new Date(election.opensAt).toLocaleDateString() : "—"}</div>
                      <div>{election.closesAt ? new Date(election.closesAt).toLocaleDateString() : "—"}</div>
                    </TableCell>
                    <TableCell>{statusBadge(election.status)}</TableCell>
                    <TableCell className="text-sm">{election.quorumPercent}%</TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <ElectionOptionsPanel election={election} adminRole={adminRole} />
                        <ProxyManagementPanel election={election} />
                        <ElectionTallyPanel election={election} adminRole={adminRole} />
                        {adminRole !== "viewer" && election.status === "draft" && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 text-xs"
                              onClick={() => generateTokensMutation.mutate(election.id)}
                              disabled={generateTokensMutation.isPending}
                              title="Generate unique ballot tokens for all eligible voters"
                            >
                              <Clock className="mr-1 h-3 w-3" />
                              Generate Tokens
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 text-xs"
                              onClick={() => updateStatusMutation.mutate({ id: election.id, status: "open" })}
                              disabled={updateStatusMutation.isPending}
                              title="Requires at least one ballot option"
                            >
                              Open Voting
                            </Button>
                          </>
                        )}
                        {adminRole !== "viewer" && election.status === "open" && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 text-xs"
                            onClick={() => updateStatusMutation.mutate({ id: election.id, status: "closed" })}
                            disabled={updateStatusMutation.isPending}
                          >
                            Close Voting
                          </Button>
                        )}
                        <a href={`/api/elections/${election.id}/result-report`} target="_blank" rel="noreferrer">
                          <Button size="icon" variant="outline" className="h-8 w-8" title="Download Result Report" aria-label="Download result report">
                            <Download className="h-3.5 w-3.5" />
                          </Button>
                        </a>
                        {election.status === "certified" && (
                          <a href={`/api/elections/${election.id}/audit-export`} target="_blank" rel="noreferrer">
                            <Button size="icon" variant="outline" className="h-8 w-8" title="Audit Trail Export" aria-label="Audit trail export">
                              <CheckCircle className="h-3.5 w-3.5" />
                            </Button>
                          </a>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </>
  );
}

export default function ElectionsPage() {
  return (
    // Wave 23 a11y: section + aria-labelledby (heading id below).
    <section className="p-4 md:p-6 space-y-5" aria-labelledby="elections-heading">
      <WorkspacePageHeader
        title={t("elections.title")}
        headingId="elections-heading"
        summary={t("elections.summary")}
        eyebrow={t("common.eyebrow.governance")}
        breadcrumbs={[
          { label: t("common.crumb.board"), href: "/app/board" },
          { label: t("elections.crumb") },
        ]}
        subPages={boardGovernanceSubPages}
      />
      <ElectionsContent />
    </section>
  );
}
