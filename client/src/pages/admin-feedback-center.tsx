import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bug,
  CheckCircle2,
  Clock3,
  ExternalLink,
  Lightbulb,
  MessageSquareText,
  Search,
  Sparkles,
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  allowedFounderFeedbackTransitions,
  type FounderFeedbackStatus,
} from "@shared/founder-feedback-lifecycle";

type FeedbackStatus = FounderFeedbackStatus;
type FeedbackPriority = "low" | "normal" | "high" | "critical";

type FeedbackEvent = {
  id: string;
  actorEmail: string;
  eventType: string;
  fromStatus: string | null;
  toStatus: string | null;
  detail: string | null;
  createdAt: string;
};

type FeedbackItem = {
  id: string;
  note: string;
  severity: "bug" | "idea" | "looks-wrong" | null;
  route: string;
  pageTitle: string | null;
  surface: string;
  status: FeedbackStatus;
  priority: FeedbackPriority;
  assignedTo: string | null;
  adminNotes: string | null;
  resolutionSummary: string | null;
  appVersion: string | null;
  viewportWidth: number | null;
  viewportHeight: number | null;
  createdAt: string;
  updatedAt: string;
  events: FeedbackEvent[];
};

type FeedbackCenterResponse = {
  items: FeedbackItem[];
  counts: Record<string, number>;
  openCount: number;
};

const STATUS_LABELS: Record<FeedbackStatus, string> = {
  new: "New",
  triaged: "Triaged",
  planned: "Planned",
  in_progress: "In progress",
  resolved: "Resolved",
  dismissed: "Dismissed",
};

const STATUS_FLOW: FeedbackStatus[] = ["new", "triaged", "planned", "in_progress", "resolved"];

function relativeTime(value: string) {
  const seconds = Math.round((new Date(value).getTime() - Date.now()) / 1000);
  const formatter = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
  const ranges: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ["year", 31_536_000],
    ["month", 2_592_000],
    ["day", 86_400],
    ["hour", 3_600],
    ["minute", 60],
  ];
  for (const [unit, size] of ranges) {
    if (Math.abs(seconds) >= size) return formatter.format(Math.round(seconds / size), unit);
  }
  return formatter.format(seconds, "second");
}

function SeverityIcon({ severity }: { severity: FeedbackItem["severity"] }) {
  if (severity === "bug") return <Bug className="h-4 w-4" />;
  if (severity === "idea") return <Lightbulb className="h-4 w-4" />;
  return <Sparkles className="h-4 w-4" />;
}

export default function AdminFeedbackCenterPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<FeedbackStatus | "open" | "all">("open");
  const [search, setSearch] = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  const [adminNotes, setAdminNotes] = useState("");
  const [resolutionSummary, setResolutionSummary] = useState("");

  const { data, isLoading } = useQuery<FeedbackCenterResponse>({
    queryKey: ["/api/admin/founder-feedback"],
    staleTime: 15_000,
  });

  const visibleItems = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return (data?.items || []).filter((item) => {
      const statusMatches = statusFilter === "all"
        || (statusFilter === "open" && !["resolved", "dismissed"].includes(item.status))
        || item.status === statusFilter;
      const searchMatches = !normalizedSearch
        || [item.note, item.route, item.pageTitle, item.assignedTo]
          .filter(Boolean)
          .some((value) => value!.toLowerCase().includes(normalizedSearch));
      return statusMatches && searchMatches;
    });
  }, [data?.items, search, statusFilter]);

  const selected = visibleItems.find((item) => item.id === selectedId) || visibleItems[0] || null;

  useEffect(() => {
    if (!selected) return;
    setSelectedId(selected.id);
    setAssignedTo(selected.assignedTo || "");
    setAdminNotes(selected.adminNotes || "");
    setResolutionSummary(selected.resolutionSummary || "");
  }, [selected?.id]);

  const updateMutation = useMutation({
    mutationFn: async (input: { id: string; patch: Partial<Pick<FeedbackItem, "status" | "priority" | "assignedTo" | "adminNotes" | "resolutionSummary">> }) => {
      const response = await apiRequest("PATCH", `/api/admin/founder-feedback/${input.id}`, input.patch);
      return response.json() as Promise<FeedbackItem>;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/admin/founder-feedback"] });
      toast({ title: "Feedback updated" });
    },
    onError: (error: Error) => {
      toast({ title: "Could not update feedback", description: error.message, variant: "destructive" });
    },
  });

  const saveDetail = () => {
    if (!selected) return;
    updateMutation.mutate({
      id: selected.id,
      patch: {
        assignedTo: assignedTo.trim() || null,
        adminNotes: adminNotes.trim() || null,
        resolutionSummary: resolutionSummary.trim() || null,
      },
    });
  };

  return (
    <main className="min-h-full bg-[#f4f7f6] p-4 text-slate-950 sm:p-6 lg:p-8" data-testid="admin-feedback-center">
      <div className="mx-auto max-w-[1500px] space-y-6">
        <header className="overflow-hidden rounded-[28px] border border-[#c8d8d4] bg-[#063f3a] text-white shadow-[0_18px_50px_rgba(6,63,58,0.16)]">
          <div className="grid gap-6 px-6 py-7 lg:grid-cols-[1fr_auto] lg:items-end lg:px-9">
            <div>
              <div className="mb-3 flex items-center gap-2 font-mono text-xs uppercase tracking-[0.18em] text-[#96d6c8]">
                <MessageSquareText className="h-4 w-4" /> YCM-owned operations queue
              </div>
              <h1 className="text-3xl font-semibold tracking-[-0.035em] sm:text-4xl">Feedback Center</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-[#d4ece7] sm:text-base">
                Every note stays inside YCM—from the screen where it was captured through review, ownership, resolution, and audit history.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-2xl bg-white/10 px-4 py-3"><div className="text-2xl font-semibold">{data?.openCount || 0}</div><div className="text-xs text-[#bfe1da]">Open</div></div>
              <div className="rounded-2xl bg-white/10 px-4 py-3"><div className="text-2xl font-semibold">{data?.counts.in_progress || 0}</div><div className="text-xs text-[#bfe1da]">Active</div></div>
              <div className="rounded-2xl bg-white/10 px-4 py-3"><div className="text-2xl font-semibold">{data?.counts.resolved || 0}</div><div className="text-xs text-[#bfe1da]">Resolved</div></div>
            </div>
          </div>
        </header>

        <section className="grid min-h-[650px] gap-4 lg:grid-cols-[minmax(320px,0.8fr)_minmax(500px,1.2fr)]">
          <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white">
            <div className="space-y-3 border-b border-slate-200 p-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search notes, routes, or owners" className="pl-9" />
              </div>
              <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as typeof statusFilter)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="open">Open feedback</SelectItem>
                  <SelectItem value="all">All feedback</SelectItem>
                  {STATUS_FLOW.map((status) => <SelectItem key={status} value={status}>{STATUS_LABELS[status]}</SelectItem>)}
                  <SelectItem value="dismissed">Dismissed</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="max-h-[720px] overflow-y-auto p-2">
              {isLoading ? <div className="p-8 text-center text-sm text-slate-500">Loading feedback…</div> : null}
              {!isLoading && visibleItems.length === 0 ? (
                <div className="p-10 text-center"><CheckCircle2 className="mx-auto mb-3 h-8 w-8 text-emerald-600" /><p className="font-medium">No feedback in this view</p><p className="mt-1 text-sm text-slate-500">New submissions will appear here automatically.</p></div>
              ) : null}
              {visibleItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelectedId(item.id)}
                  className={`mb-2 w-full rounded-2xl border p-4 text-left transition ${selected?.id === item.id ? "border-[#128071] bg-[#eef9f6] shadow-sm" : "border-transparent hover:border-slate-200 hover:bg-slate-50"}`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500"><SeverityIcon severity={item.severity} />{item.severity || "feedback"}</span>
                    <span className="text-xs text-slate-400">{relativeTime(item.createdAt)}</span>
                  </div>
                  <p className="mt-2 line-clamp-2 text-sm font-medium leading-5">{item.note}</p>
                  <div className="mt-3 flex items-center justify-between gap-2">
                    <Badge variant="secondary">{STATUS_LABELS[item.status]}</Badge>
                    <span className="truncate font-mono text-[11px] text-slate-500">{item.route}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-7">
            {!selected ? (
              <div className="flex min-h-[520px] items-center justify-center text-sm text-slate-500">Choose a feedback item to review.</div>
            ) : (
              <div className="space-y-7">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className="bg-[#063f3a] text-white hover:bg-[#063f3a]">{STATUS_LABELS[selected.status]}</Badge>
                    <Badge variant="outline">{selected.priority} priority</Badge>
                    <Badge variant="outline">{selected.surface}</Badge>
                  </div>
                  <h2 className="mt-4 text-2xl font-semibold leading-tight tracking-[-0.02em]">{selected.note}</h2>
                  <a href={selected.route} className="mt-3 inline-flex items-center gap-1.5 font-mono text-xs text-[#0b6b60] hover:underline">
                    {selected.pageTitle || selected.route} <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </div>

                <div className="rounded-2xl border border-[#d6e5e1] bg-[#f6fbfa] p-4">
                  <div className="mb-3 font-mono text-[11px] uppercase tracking-[0.16em] text-[#46756f]">Lifecycle</div>
                  <div className="flex flex-wrap gap-2">
                    {STATUS_FLOW.map((status) => (
                      <Button
                        key={status}
                        type="button"
                        size="sm"
                        variant={selected.status === status ? "default" : "outline"}
                        onClick={() => updateMutation.mutate({ id: selected.id, patch: { status } })}
                        disabled={updateMutation.isPending || (selected.status !== status && !allowedFounderFeedbackTransitions[selected.status].includes(status))}
                      >
                        {STATUS_LABELS[status]}
                      </Button>
                    ))}
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={!allowedFounderFeedbackTransitions[selected.status].includes("dismissed")}
                      onClick={() => updateMutation.mutate({ id: selected.id, patch: { status: "dismissed" } })}
                    >Dismiss</Button>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="space-y-2 text-sm font-medium">Priority
                    <Select value={selected.priority} onValueChange={(priority) => updateMutation.mutate({ id: selected.id, patch: { priority: priority as FeedbackPriority } })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{(["low", "normal", "high", "critical"] as const).map((priority) => <SelectItem key={priority} value={priority}>{priority.charAt(0).toUpperCase() + priority.slice(1)}</SelectItem>)}</SelectContent>
                    </Select>
                  </label>
                  <label className="space-y-2 text-sm font-medium">Owner
                    <Input value={assignedTo} onChange={(event) => setAssignedTo(event.target.value)} placeholder="Name or team" />
                  </label>
                </div>

                <label className="block space-y-2 text-sm font-medium">Internal working notes
                  <Textarea value={adminNotes} onChange={(event) => setAdminNotes(event.target.value)} rows={4} placeholder="Diagnosis, constraints, and next action" />
                </label>
                <label className="block space-y-2 text-sm font-medium">Resolution summary
                  <Textarea value={resolutionSummary} onChange={(event) => setResolutionSummary(event.target.value)} rows={3} placeholder="What changed and how it was verified" />
                </label>
                <div className="flex justify-end"><Button onClick={saveDetail} disabled={updateMutation.isPending}>{updateMutation.isPending ? "Saving…" : "Save details"}</Button></div>

                <div className="border-t border-slate-200 pt-6">
                  <h3 className="flex items-center gap-2 text-sm font-semibold"><Clock3 className="h-4 w-4 text-[#0b6b60]" />Audit history</h3>
                  <ol className="mt-4 space-y-4 border-l border-slate-200 pl-5">
                    {selected.events.map((event) => (
                      <li key={event.id} className="relative">
                        <span className="absolute -left-[25px] top-1.5 h-2 w-2 rounded-full bg-[#128071] ring-4 ring-white" />
                        <p className="text-sm font-medium">{event.detail || event.eventType.replaceAll("_", " ")}</p>
                        <p className="mt-1 text-xs text-slate-500">{event.actorEmail} · {new Date(event.createdAt).toLocaleString()}</p>
                      </li>
                    ))}
                  </ol>
                </div>

                <div className="grid grid-cols-2 gap-3 rounded-2xl bg-slate-50 p-4 text-xs text-slate-600 sm:grid-cols-4">
                  <div><span className="block text-slate-400">Captured</span>{new Date(selected.createdAt).toLocaleString()}</div>
                  <div><span className="block text-slate-400">Viewport</span>{selected.viewportWidth || "?"} × {selected.viewportHeight || "?"}</div>
                  <div><span className="block text-slate-400">App version</span><span className="break-all font-mono">{selected.appVersion || "unknown"}</span></div>
                  <div><span className="block text-slate-400">Record</span><span className="font-mono">{selected.id.slice(0, 8)}</span></div>
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
