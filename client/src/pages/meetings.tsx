// zone: Governance
// persona: Manager, Board Officer, Assisted Board, PM Assistant
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import type { GovernanceMeeting, MeetingAgendaItem, Person, Resolution, VoteRecord, Election } from "@shared/schema";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useActiveAssociation } from "@/hooks/use-active-association";
import { useIsMobile } from "@/hooks/use-mobile";
import { Send, Users, FileText, CheckSquare, Square, ChevronDown, ChevronRight, Settings2, Vote, Gavel, ExternalLink, CalendarDays } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { WorkspacePageHeader } from "@/components/workspace-page-header";
import { t } from "@/i18n/use-strings";
import { boardGovernanceSubPages } from "@/lib/sub-page-nav";
import type { GovernanceReminderRule } from "@shared/schema";

// ─── Schemas ─────────────────────────────────────────────────────────────────

const scheduleSchema = z.object({
  associationId: z.string().min(1),
  meetingType: z.string().min(1),
  title: z.string().min(1),
  scheduledAt: z.string().min(1),
  location: z.string().optional(),
  agenda: z.string().optional(),
});

const agendaItemSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  orderIndex: z.coerce.number().int().min(0),
});

const resolutionSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
});

const voteSchema = z.object({
  voterPersonId: z.string().min(1, "Select a voter"),
  voteChoice: z.enum(["yes", "no", "abstain"]),
});

const noteSchema = z.object({
  notes: z.string().optional(),
  summaryText: z.string().optional(),
});

// ─── Meeting Notice Dialog ────────────────────────────────────────────────────

function MeetingNoticeDialog({
  meeting,
  associationId,
  associationName,
}: {
  meeting: GovernanceMeeting;
  associationId: string;
  associationName: string;
}) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);

  const meetingDate = new Date(meeting.scheduledAt);
  const formattedDate = meetingDate.toLocaleDateString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });
  const formattedTime = meetingDate.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });

  const defaultSubject = `Meeting Notice — ${meeting.title}`;
  const defaultBody = [
    `Dear ${associationName} Owners and Residents,`,
    ``,
    `You are hereby notified that a ${meeting.meetingType} meeting has been scheduled.`,
    ``,
    `Meeting Details:`,
    `  Title: ${meeting.title}`,
    `  Date: ${formattedDate}`,
    `  Time: ${formattedTime}`,
    ...(meeting.location ? [`  Location: ${meeting.location}`] : []),
    ``,
    ...(meeting.agenda ? [`Agenda:\n${meeting.agenda}`, ``] : []),
    `If you have questions, please contact your association management office.`,
    ``,
    `Thank you,`,
    `${associationName} Board of Directors`,
  ].join("\n");

  const [subject, setSubject] = useState(defaultSubject);
  const [body, setBody] = useState(defaultBody);
  const [targetType, setTargetType] = useState<"all-owners" | "all-occupants" | "board-members">("all-owners");

  useEffect(() => {
    if (open) {
      setSubject(defaultSubject);
      setBody(defaultBody);
    }
  }, [open]);

  const sendMutation = useMutation({
    mutationFn: () =>
      apiRequest("POST", "/api/communications/send-targeted", {
        associationId,
        targetType,
        subject: subject.trim(),
        body: body.trim(),
        messageClass: "governance",
        bypassReadinessGate: true,
      }).then((r) => r.json()),
    onSuccess: (result) => {
      toast({ title: "Meeting notice sent", description: `Notice sent to ${result.recipientCount ?? "all"} recipients` });
      setOpen(false);
    },
    onError: (err: Error) => toast({ title: "Send failed", description: err.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="icon" variant="outline" title="Send Notice" aria-label="Send meeting notice">
          <Send className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-[calc(100vw-2rem)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Send Meeting Notice</DialogTitle>
          <DialogDescription>Send a formal meeting notice to residents. Edit before sending.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="rounded-lg border bg-muted/20 p-3 text-sm space-y-1">
            <div><span className="text-muted-foreground">Meeting: </span><strong>{meeting.title}</strong></div>
            <div><span className="text-muted-foreground">Date: </span>{formattedDate} at {formattedTime}</div>
            {meeting.location && <div><span className="text-muted-foreground">Location: </span>{meeting.location}</div>}
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Send to</label>
            <Select value={targetType} onValueChange={(v) => setTargetType(v as typeof targetType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all-owners">All owners</SelectItem>
                <SelectItem value="all-occupants">All occupants (owners + tenants)</SelectItem>
                <SelectItem value="board-members">Board members only</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Subject</label>
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Message</label>
            <Textarea rows={10} value={body} onChange={(e) => setBody(e.target.value)} className="font-mono text-xs" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={() => sendMutation.mutate()} disabled={sendMutation.isPending || !subject.trim() || !body.trim()}>
            {sendMutation.isPending ? "Sending…" : "Send Notice"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Quorum Dialog ────────────────────────────────────────────────────────────

function QuorumDialog({ meeting, persons }: { meeting: GovernanceMeeting; persons: Person[] }) {
  const [open, setOpen] = useState(false);
  const [present, setPresent] = useState<Set<string>>(new Set());

  const total = persons.length;
  const presentCount = present.size;
  const quorumThreshold = Math.ceil(total / 2);
  const quorumMet = presentCount >= quorumThreshold;

  function toggle(id: string) {
    setPresent((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="icon" variant="outline" title="Attendance & Quorum" aria-label="Attendance and quorum">
          <Users className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-[calc(100vw-2rem)] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Attendance &amp; Quorum</DialogTitle>
          <DialogDescription>{meeting.title}</DialogDescription>
        </DialogHeader>
        <div className={`rounded-lg border p-3 text-sm font-medium ${quorumMet ? "bg-green-50 border-green-200 text-green-800" : "bg-red-50 border-red-200 text-red-700"}`}>
          {quorumMet ? "✓ Quorum met" : "✗ Quorum not met"} — {presentCount} of {total} present
          {total > 0 && ` (need ${quorumThreshold})`}
        </div>
        <div className="space-y-1 max-h-72 overflow-y-auto">
          {persons.length === 0 && (
            <p className="text-sm text-muted-foreground py-4 text-center">No persons found for this association.</p>
          )}
          {persons.map((p) => (
            <button
              key={p.id}
              onClick={() => toggle(p.id)}
              className="w-full flex items-center gap-2 rounded border px-3 py-2 text-sm hover:bg-accent text-left"
            >
              {present.has(p.id) ? (
                <CheckSquare className="h-4 w-4 text-primary shrink-0" />
              ) : (
                <Square className="h-4 w-4 text-muted-foreground shrink-0" />
              )}
              <span className={present.has(p.id) ? "font-medium" : "text-muted-foreground"}>
                {p.firstName} {p.lastName}
              </span>
            </button>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── In-Meeting Vote Dialog (WS4.3) ──────────────────────────────────────────

function InMeetingVoteDialog({
  meeting,
  associationId,
  persons,
  onSuccess,
}: {
  meeting: GovernanceMeeting;
  associationId: string;
  persons: Person[];
  onSuccess: () => void;
}) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [resolutionTitle, setResolutionTitle] = useState("");
  const [memberVotes, setMemberVotes] = useState<Record<string, "aye" | "nay" | "abstain">>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setResolutionTitle("");
      setMemberVotes({});
    }
  }, [open]);

  function setVote(personId: string, choice: "aye" | "nay" | "abstain") {
    setMemberVotes((prev) => ({ ...prev, [personId]: choice }));
  }

  // Tally
  const votedCount = Object.keys(memberVotes).length;
  const ayeCount = Object.values(memberVotes).filter((v) => v === "aye").length;
  const nayCount = Object.values(memberVotes).filter((v) => v === "nay").length;
  const abstainCount = Object.values(memberVotes).filter((v) => v === "abstain").length;
  const result = votedCount > 0
    ? ayeCount > nayCount ? "Passed" : ayeCount < nayCount ? "Failed" : "Tied"
    : null;

  async function handleRecordVote() {
    if (!resolutionTitle.trim() || votedCount === 0) return;
    setIsSubmitting(true);
    try {
      // Create the election as a board-only resolution linked to this meeting
      const electionRes = await apiRequest("POST", "/api/elections", {
        associationId,
        meetingId: meeting.id,
        title: resolutionTitle.trim(),
        description: `In-meeting board vote recorded during "${meeting.title}". Result: ${result} (Aye: ${ayeCount}, Nay: ${nayCount}, Abstain: ${abstainCount})`,
        voteType: "resolution",
        votingRule: "board-only",
        isSecretBallot: 0,
        resultVisibility: "public",
        status: "closed",
        quorumPercent: 50,
        eligibleVoterCount: persons.length,
        maxChoices: 1,
      });
      const election = await electionRes.json();

      // Create two options: Aye and Nay
      const ayeOptRes = await apiRequest("POST", `/api/elections/${election.id}/options`, {
        label: "Aye",
        description: null,
        displayOrder: 0,
      });
      const ayeOpt = await ayeOptRes.json();

      const nayOptRes = await apiRequest("POST", `/api/elections/${election.id}/options`, {
        label: "Nay",
        description: null,
        displayOrder: 1,
      });
      const nayOpt = await nayOptRes.json();

      // Also create Abstain option
      await apiRequest("POST", `/api/elections/${election.id}/options`, {
        label: "Abstain",
        description: null,
        displayOrder: 2,
      });

      toast({
        title: "Vote recorded",
        description: `${resolutionTitle.trim()} - ${result} (Aye: ${ayeCount}, Nay: ${nayCount}, Abstain: ${abstainCount})`,
      });
      setOpen(false);
      onSuccess();
    } catch (err: any) {
      toast({ title: "Error recording vote", description: err.message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  }

  // Only show for board meetings
  if (meeting.meetingType !== "board") return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1.5" title="Record In-Meeting Vote">
          <Gavel className="h-3.5 w-3.5" />
          In-Meeting Vote
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-[calc(100vw-2rem)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Record In-Meeting Vote</DialogTitle>
          <DialogDescription>
            Record a quick resolution vote taken during this board meeting. Each board member's vote is captured individually.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Resolution Title</label>
            <Input
              placeholder="e.g. Approve emergency roof repair expenditure"
              value={resolutionTitle}
              onChange={(e) => setResolutionTitle(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Board Member Votes</label>
            {persons.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">No persons found for this association.</p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {persons.map((p) => (
                  <div key={p.id} className="flex items-center justify-between gap-3 rounded border px-3 py-2.5">
                    <span className="text-sm font-medium min-w-0 truncate">
                      {p.firstName} {p.lastName}
                    </span>
                    <div className="flex items-center gap-3 shrink-0">
                      {(["aye", "nay", "abstain"] as const).map((choice) => (
                        <label key={choice} className="flex items-center gap-1 cursor-pointer">
                          <input
                            type="radio"
                            name={`vote-${p.id}`}
                            checked={memberVotes[p.id] === choice}
                            onChange={() => setVote(p.id, choice)}
                            className="h-4 w-4 accent-primary"
                          />
                          <span className={`text-xs font-medium capitalize ${
                            choice === "aye" ? "text-green-700" : choice === "nay" ? "text-red-700" : "text-muted-foreground"
                          }`}>
                            {choice}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Live tally */}
          {votedCount > 0 && (
            <div className={`rounded-lg border p-3 text-sm font-medium ${
              result === "Passed" ? "bg-green-50 border-green-200 text-green-800"
                : result === "Failed" ? "bg-red-50 border-red-200 text-red-700"
                : "bg-yellow-50 border-yellow-200 text-yellow-800"
            }`}>
              <div className="flex items-center justify-between">
                <span>{result}</span>
                <span className="text-xs font-normal">
                  Aye: {ayeCount} / Nay: {nayCount} / Abstain: {abstainCount}
                </span>
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button
            onClick={handleRecordVote}
            disabled={isSubmitting || !resolutionTitle.trim() || votedCount === 0}
          >
            {isSubmitting ? "Recording..." : "Record Vote"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function MeetingsContent() {
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const { activeAssociationId, activeAssociationName } = useActiveAssociation();

  // UI state
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [expandedMeetingId, setExpandedMeetingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"agenda" | "minutes" | "resolutions" | "elections">("agenda");
  const [selectedResolutionId, setSelectedResolutionId] = useState("");
  const [remindersExpanded, setRemindersExpanded] = useState(false);
  const [reminderOpen, setReminderOpen] = useState(false);
  const [reminderForm, setReminderForm] = useState({
    name: "",
    trigger: "before_meeting" as "before_meeting" | "after_meeting" | "task_due" | "board_term_expiry",
    daysOffset: 3,
    recipientType: "all_owners" as "all_owners" | "board_members" | "managers" | "meeting_attendees",
    subjectTemplate: "",
    bodyTemplate: "",
    meetingTypes: "",
    isActive: 1,
  });

  // ── Queries ────────────────────────────────────────────────────────────────

  const meetingsQueryKey = activeAssociationId
    ? `/api/governance/meetings?associationId=${activeAssociationId}`
    : "/api/governance/meetings";
  const personsQueryKey = activeAssociationId
    ? `/api/persons?associationId=${activeAssociationId}`
    : "/api/persons";
  const resolutionsQueryKey = activeAssociationId
    ? `/api/governance/resolutions?associationId=${activeAssociationId}`
    : "/api/governance/resolutions";

  const { data: meetings } = useQuery<GovernanceMeeting[]>({
    queryKey: [meetingsQueryKey],
    enabled: Boolean(activeAssociationId),
  });
  const { data: persons } = useQuery<Person[]>({
    queryKey: [personsQueryKey],
    enabled: Boolean(activeAssociationId),
  });
  const { data: agendaItems } = useQuery<MeetingAgendaItem[]>({
    queryKey: ["/api/governance/meetings", expandedMeetingId ?? "none", "agenda-items"],
    queryFn: async () => {
      if (!expandedMeetingId) return [];
      const res = await apiRequest("GET", `/api/governance/meetings/${expandedMeetingId}/agenda-items`);
      return res.json();
    },
    enabled: Boolean(expandedMeetingId),
  });
  const { data: allResolutions } = useQuery<Resolution[]>({
    queryKey: [resolutionsQueryKey],
    enabled: Boolean(activeAssociationId),
  });
  const { data: votes } = useQuery<VoteRecord[]>({
    queryKey: ["/api/governance/resolutions", selectedResolutionId || "none", "votes"],
    queryFn: async () => {
      if (!selectedResolutionId) return [];
      const res = await apiRequest("GET", `/api/governance/resolutions/${selectedResolutionId}/votes`);
      return res.json();
    },
    enabled: Boolean(selectedResolutionId),
  });
  const { data: reminderRules = [], refetch: refetchReminderRules } = useQuery<GovernanceReminderRule[]>({
    queryKey: ["/api/governance/reminder-rules", activeAssociationId],
    queryFn: async () => {
      if (!activeAssociationId) return [];
      const res = await apiRequest("GET", `/api/governance/reminder-rules?associationId=${activeAssociationId}`);
      return res.json();
    },
    enabled: Boolean(activeAssociationId),
  });

  const { data: linkedElections = [] } = useQuery<Election[]>({
    queryKey: ["/api/elections", "meeting", expandedMeetingId],
    queryFn: async () => {
      if (!expandedMeetingId || !activeAssociationId) return [];
      const res = await apiRequest("GET", `/api/elections?associationId=${activeAssociationId}&meetingId=${expandedMeetingId}`);
      return res.json();
    },
    enabled: Boolean(expandedMeetingId) && Boolean(activeAssociationId),
  });

  // ── Derived data ───────────────────────────────────────────────────────────

  const expandedMeeting = useMemo(
    () => meetings?.find((m) => m.id === expandedMeetingId) ?? null,
    [meetings, expandedMeetingId],
  );

  const meetingResolutions = useMemo(
    () => (allResolutions ?? []).filter((r) => r.meetingId === expandedMeetingId),
    [allResolutions, expandedMeetingId],
  );

  const { activeMeetings, completedMeetings } = useMemo(() => {
    const sorted = [...(meetings ?? [])].sort(
      (a, b) => new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime(),
    );
    return {
      activeMeetings: sorted.filter((m) => m.status !== "completed"),
      completedMeetings: sorted.filter((m) => m.status === "completed"),
    };
  }, [meetings]);

  const resolutionNumbers = useMemo(() => {
    const sorted = [...(allResolutions ?? [])].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );
    const map = new Map<string, string>();
    const yearCounters: Record<string, number> = {};
    for (const r of sorted) {
      const year = new Date(r.createdAt).getFullYear();
      yearCounters[year] = (yearCounters[year] ?? 0) + 1;
      map.set(r.id, `R-${year}-${String(yearCounters[year]).padStart(3, "0")}`);
    }
    return map;
  }, [allResolutions]);

  // ── Forms ──────────────────────────────────────────────────────────────────

  const scheduleForm = useForm<z.infer<typeof scheduleSchema>>({
    resolver: zodResolver(scheduleSchema),
    defaultValues: { associationId: "", meetingType: "board", title: "", scheduledAt: "", location: "", agenda: "" },
  });
  const agendaForm = useForm<z.infer<typeof agendaItemSchema>>({
    resolver: zodResolver(agendaItemSchema),
    defaultValues: { title: "", description: "", orderIndex: 0 },
  });
  const resolutionForm = useForm<z.infer<typeof resolutionSchema>>({
    resolver: zodResolver(resolutionSchema),
    defaultValues: { title: "", description: "" },
  });
  const voteForm = useForm<z.infer<typeof voteSchema>>({
    resolver: zodResolver(voteSchema),
    defaultValues: { voterPersonId: "", voteChoice: "yes" },
  });
  const noteForm = useForm<z.infer<typeof noteSchema>>({
    resolver: zodResolver(noteSchema),
    defaultValues: { notes: "", summaryText: "" },
  });

  // ── Effects ────────────────────────────────────────────────────────────────

  useEffect(() => {
    scheduleForm.setValue("associationId", activeAssociationId, { shouldValidate: true });
    setExpandedMeetingId(null);
    setSelectedResolutionId("");
  }, [activeAssociationId, scheduleForm]);

  useEffect(() => {
    if (expandedMeeting) {
      noteForm.reset({
        notes: expandedMeeting.notes || "",
        summaryText: expandedMeeting.summaryText || "",
      });
    }
  }, [expandedMeetingId]);

  // ── Mutations ──────────────────────────────────────────────────────────────

  const invalidateMeetings = () =>
    queryClient.invalidateQueries({
      predicate: (q) => String(q.queryKey[0] ?? "").startsWith("/api/governance/meetings"),
    });
  const invalidateResolutions = () =>
    queryClient.invalidateQueries({
      predicate: (q) => String(q.queryKey[0] ?? "").startsWith("/api/governance/resolutions"),
    });
  const invalidateElections = () =>
    queryClient.invalidateQueries({
      predicate: (q) => String(q.queryKey[0] ?? "").startsWith("/api/elections"),
    });

  const createMeeting = useMutation({
    mutationFn: async (v: z.infer<typeof scheduleSchema>) => {
      const res = await apiRequest("POST", "/api/governance/meetings", {
        associationId: v.associationId,
        meetingType: v.meetingType,
        title: v.title,
        scheduledAt: new Date(v.scheduledAt).toISOString(),
        location: v.location || null,
        agenda: v.agenda || null,
        notes: null,
        status: "scheduled",
        summaryStatus: "draft",
      });
      return res.json();
    },
    onSuccess: (meeting) => {
      invalidateMeetings();
      setScheduleOpen(false);
      scheduleForm.reset({ associationId: activeAssociationId, meetingType: "board", title: "", scheduledAt: "", location: "", agenda: "" });
      setExpandedMeetingId(meeting.id);
      setActiveTab("agenda");
      toast({ title: "Meeting scheduled" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const updateMeeting = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: Record<string, unknown> }) => {
      const res = await apiRequest("PATCH", `/api/governance/meetings/${id}`, payload);
      return res.json();
    },
    onSuccess: invalidateMeetings,
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const addAgendaItem = useMutation({
    mutationFn: async (v: z.infer<typeof agendaItemSchema>) => {
      if (!expandedMeetingId) throw new Error("No meeting selected");
      const res = await apiRequest("POST", `/api/governance/meetings/${expandedMeetingId}/agenda-items`, v);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/governance/meetings", expandedMeetingId ?? "none", "agenda-items"],
      });
      agendaForm.reset({ title: "", description: "", orderIndex: (agendaItems?.length ?? 0) });
      toast({ title: "Agenda item added" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const addResolution = useMutation({
    mutationFn: async (v: z.infer<typeof resolutionSchema>) => {
      if (!activeAssociationId || !expandedMeetingId) throw new Error("No meeting selected");
      const res = await apiRequest("POST", "/api/governance/resolutions", {
        associationId: activeAssociationId,
        meetingId: expandedMeetingId,
        title: v.title,
        description: v.description || null,
        status: "open",
      });
      return res.json();
    },
    onSuccess: (resolution) => {
      invalidateResolutions();
      resolutionForm.reset();
      setSelectedResolutionId(resolution.id);
      toast({ title: "Resolution created" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const addVote = useMutation({
    mutationFn: async (v: z.infer<typeof voteSchema>) => {
      if (!selectedResolutionId) throw new Error("Select a resolution first");
      const res = await apiRequest("POST", `/api/governance/resolutions/${selectedResolutionId}/votes`, {
        voterPersonId: v.voterPersonId,
        voteChoice: v.voteChoice,
        voteWeight: 1,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/governance/resolutions", selectedResolutionId, "votes"],
      });
      invalidateResolutions();
      voteForm.reset({ voterPersonId: "", voteChoice: "yes" });
      toast({ title: "Vote recorded" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const createReminderRule = useMutation({
    mutationFn: async () => {
      if (!activeAssociationId) throw new Error("No association selected");
      const res = await apiRequest("POST", "/api/governance/reminder-rules", {
        associationId: activeAssociationId,
        ...reminderForm,
        meetingTypes: reminderForm.meetingTypes || null,
      });
      return res.json();
    },
    onSuccess: () => {
      void refetchReminderRules();
      setReminderOpen(false);
      setReminderForm({
        name: "", trigger: "before_meeting", daysOffset: 3, recipientType: "all_owners",
        subjectTemplate: "", bodyTemplate: "", meetingTypes: "", isActive: 1,
      });
      toast({ title: "Reminder rule created" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const runReminderRule = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("POST", `/api/governance/reminder-rules/${id}/run`);
      return res.json();
    },
    onSuccess: (data: { sent: number; meetings: number }) =>
      toast({ title: "Reminders sent", description: `${data.sent} notices for ${data.meetings} meeting(s)` }),
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const toggleReminderRule = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: number }) => {
      const res = await apiRequest("PATCH", `/api/governance/reminder-rules/${id}`, { isActive });
      return res.json();
    },
    onSuccess: () => void refetchReminderRules(),
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  // ── Helpers ────────────────────────────────────────────────────────────────

  function toggleMeeting(id: string) {
    if (expandedMeetingId === id) {
      setExpandedMeetingId(null);
    } else {
      setExpandedMeetingId(id);
      setActiveTab("agenda");
      setSelectedResolutionId("");
    }
  }

  function renderMeetingRow(m: GovernanceMeeting) {
    const isExpanded = expandedMeetingId === m.id;
    const dateStr = new Date(m.scheduledAt).toLocaleDateString("en-US", {
      weekday: "short", year: "numeric", month: "short", day: "numeric",
    });
    const timeStr = new Date(m.scheduledAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });

    return (
      <div key={m.id} className="rounded-lg border overflow-hidden">
        {/* Row header */}
        <div className="flex items-center gap-2 p-4">
          <button
            className="flex-1 flex items-center gap-3 text-left min-w-0"
            onClick={() => toggleMeeting(m.id)}
          >
            {isExpanded
              ? <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
              : <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
            }
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-sm">{m.title}</span>
                <Badge variant="secondary" className="capitalize">{m.meetingType}</Badge>
                {m.summaryStatus === "published" && <Badge>Minutes Published</Badge>}
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {dateStr} at {timeStr}{m.location ? ` · ${m.location}` : ""}
              </div>
            </div>
          </button>
          {/* Quick actions — stop propagation so they don't toggle expansion */}
          <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
            {activeAssociationId && (
              <MeetingNoticeDialog
                meeting={m}
                associationId={activeAssociationId}
                associationName={activeAssociationName}
              />
            )}
            <QuorumDialog meeting={m} persons={persons ?? []} />
          </div>
        </div>

        {/* Expanded detail */}
        {isExpanded && (
          <div className="border-t">
            {/* Tab bar */}
            <div className="flex border-b bg-muted/20">
              {(["agenda", "minutes", "resolutions", "elections"] as const).map((tab) => {
                const label =
                  tab === "resolutions"
                    ? `Resolutions${meetingResolutions.length > 0 ? ` (${meetingResolutions.length})` : ""}`
                    : tab === "elections"
                    ? `Elections${linkedElections.length > 0 ? ` (${linkedElections.length})` : ""}`
                    : tab.charAt(0).toUpperCase() + tab.slice(1);
                return (
                  <button
                    key={tab}
                    className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                      activeTab === tab
                        ? "border-primary text-primary bg-background"
                        : "border-transparent text-muted-foreground hover:text-foreground"
                    }`}
                    onClick={() => setActiveTab(tab)}
                  >
                    {label}
                  </button>
                );
              })}
            </div>

            {/* Tab content */}
            <div className="p-4 space-y-4">

              {/* ── Agenda tab ── */}
              {activeTab === "agenda" && (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">Build the meeting agenda before the meeting. Items appear in order and are included when generating draft minutes.</p>
                  <Form {...agendaForm}>
                    <form
                      className="flex gap-2 flex-wrap items-end"
                      onSubmit={agendaForm.handleSubmit((v) => addAgendaItem.mutate(v))}
                    >
                      <FormField control={agendaForm.control} name="title" render={({ field }) => (
                        <FormItem className="flex-1 min-w-[160px]">
                          <FormLabel className="text-xs">Item title</FormLabel>
                          <FormControl><Input placeholder="e.g. Approve prior minutes" {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={agendaForm.control} name="description" render={({ field }) => (
                        <FormItem className="flex-1 min-w-[140px]">
                          <FormLabel className="text-xs">Notes (optional)</FormLabel>
                          <FormControl><Input placeholder="Brief context" {...field} /></FormControl>
                        </FormItem>
                      )} />
                      <Button type="submit" size="sm" disabled={addAgendaItem.isPending} className={isMobile ? "w-full min-h-11" : undefined}>
                        Add Item
                      </Button>
                    </form>
                  </Form>

                  <div className="space-y-1">
                    {[...(agendaItems ?? [])].sort((a, b) => a.orderIndex - b.orderIndex).map((item) => (
                      <div key={item.id} className="flex items-start gap-3 rounded border px-3 py-2.5 text-sm">
                        <span className="text-muted-foreground shrink-0 font-mono text-xs mt-0.5 w-5 text-right">
                          {item.orderIndex + 1}.
                        </span>
                        <div>
                          <div className="font-medium">{item.title}</div>
                          {item.description && (
                            <div className="text-muted-foreground text-xs mt-0.5">{item.description}</div>
                          )}
                        </div>
                      </div>
                    ))}
                    {!agendaItems?.length && (
                      <p className="text-sm text-muted-foreground py-2">
                        No agenda items yet. Add the first one above.
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* ── Minutes tab ── */}
              {activeTab === "minutes" && (
                <div className="space-y-4">
                <p className="text-sm text-muted-foreground">Capture notes during the meeting, then generate a formatted draft you can edit and publish for owners to view.</p>
                <Form {...noteForm}>
                  <form
                    className="space-y-4"
                    onSubmit={noteForm.handleSubmit((v) => {
                      updateMeeting.mutate({
                        id: m.id,
                        payload: { notes: v.notes || null, summaryText: v.summaryText || null },
                      });
                    })}
                  >
                    <FormField control={noteForm.control} name="notes" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Meeting Notes</FormLabel>
                        <FormControl>
                          <Textarea
                            rows={4}
                            placeholder="Record discussion points, decisions, and action items…"
                            {...field}
                          />
                        </FormControl>
                      </FormItem>
                    )} />

                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <FormLabel>Draft Minutes</FormLabel>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="gap-1.5"
                          onClick={() => {
                            const meetingDate = new Date(m.scheduledAt);
                            const fmtDate = meetingDate.toLocaleDateString("en-US", {
                              weekday: "long", year: "numeric", month: "long", day: "numeric",
                            });
                            const fmtTime = meetingDate.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
                            const agendaLines = [...(agendaItems ?? [])]
                              .sort((a, b) => a.orderIndex - b.orderIndex)
                              .map((item) => `  ${item.orderIndex + 1}. ${item.title}${item.description ? ` — ${item.description}` : ""}`)
                              .join("\n");
                            const resLines = meetingResolutions
                              .map((r) => `  - ${r.title} [${r.status}]${r.description ? `\n    ${r.description}` : ""}`)
                              .join("\n");
                            const notes = noteForm.getValues("notes");
                            const draft = [
                              `MEETING MINUTES`,
                              `================`,
                              `${activeAssociationName || "Association"}`,
                              `${m.meetingType.charAt(0).toUpperCase() + m.meetingType.slice(1)} Meeting`,
                              ``,
                              `Date: ${fmtDate}`,
                              `Time: ${fmtTime}`,
                              ...(m.location ? [`Location: ${m.location}`] : []),
                              ``,
                              `CALL TO ORDER`,
                              `The ${m.meetingType} meeting was called to order.`,
                              ``,
                              ...(agendaLines ? [`AGENDA\n${agendaLines}`, ``] : []),
                              ...(notes ? [`DISCUSSION\n${notes}`, ``] : []),
                              ...(resLines ? [`RESOLUTIONS\n${resLines}`, ``] : []),
                              `ADJOURNMENT`,
                              `There being no further business, the meeting was adjourned.`,
                              ``,
                              `_______________________________`,
                              `Secretary, ${activeAssociationName || "Association"}`,
                            ].join("\n");
                            noteForm.setValue("summaryText", draft);
                          }}
                        >
                          <FileText className="h-3.5 w-3.5" />
                          Generate Draft
                        </Button>
                      </div>
                      <FormField control={noteForm.control} name="summaryText" render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <Textarea
                              rows={14}
                              className="font-mono text-xs"
                              placeholder="Formatted minutes will appear here after generating a draft or typing directly…"
                              {...field}
                            />
                          </FormControl>
                        </FormItem>
                      )} />
                    </div>

                    <Button type="submit" size="sm" disabled={updateMeeting.isPending}>
                      Save Minutes
                    </Button>
                  </form>
                </Form>
                </div>
              )}

              {/* ── Resolutions tab ── */}
              {activeTab === "resolutions" && (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">Record formal decisions made during the meeting. Click a resolution to expand it and log board member votes.</p>
                  <Form {...resolutionForm}>
                    <form
                      className="flex gap-2 flex-wrap items-end"
                      onSubmit={resolutionForm.handleSubmit((v) => addResolution.mutate(v))}
                    >
                      <FormField control={resolutionForm.control} name="title" render={({ field }) => (
                        <FormItem className="flex-1 min-w-[200px]">
                          <FormLabel className="text-xs">Resolution title</FormLabel>
                          <FormControl><Input placeholder="e.g. Approve Q2 maintenance budget" {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={resolutionForm.control} name="description" render={({ field }) => (
                        <FormItem className="flex-1 min-w-[140px]">
                          <FormLabel className="text-xs">Description (optional)</FormLabel>
                          <FormControl><Input placeholder="Additional context" {...field} /></FormControl>
                        </FormItem>
                      )} />
                      <Button type="submit" size="sm" disabled={addResolution.isPending} className={isMobile ? "w-full min-h-11" : undefined}>
                        Add Resolution
                      </Button>
                    </form>
                  </Form>

                  {meetingResolutions.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-2">
                      No resolutions yet. Add one above to formally record a decision and capture board votes.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {meetingResolutions.map((r) => {
                        const isActive = r.id === selectedResolutionId;
                        const rVotes = isActive ? (votes ?? []) : [];
                        return (
                          <div
                            key={r.id}
                            className={`rounded-lg border overflow-hidden ${isActive ? "border-primary/50" : ""}`}
                          >
                            <button
                              className="w-full flex items-start justify-between gap-3 p-3 text-left hover:bg-muted/30 transition-colors"
                              onClick={() => setSelectedResolutionId(isActive ? "" : r.id)}
                            >
                              <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <code className="text-xs font-mono text-muted-foreground">
                                    {resolutionNumbers.get(r.id) || "—"}
                                  </code>
                                  <span className="text-sm font-medium">{r.title}</span>
                                </div>
                                {r.description && (
                                  <p className="text-xs text-muted-foreground mt-0.5">{r.description}</p>
                                )}
                              </div>
                              <Badge
                                variant={
                                  r.status === "approved" ? "default"
                                  : r.status === "rejected" ? "destructive"
                                  : "secondary"
                                }
                                className="shrink-0"
                              >
                                {r.status}
                              </Badge>
                            </button>

                            {isActive && (
                              <div className="border-t bg-muted/10 p-3 space-y-3">
                                {/* Tally */}
                                <div className="flex gap-3 flex-wrap text-sm">
                                  <span className="text-muted-foreground">{rVotes.length} vote{rVotes.length !== 1 ? "s" : ""}:</span>
                                  <span className="font-medium text-green-700">Yes {rVotes.filter((v) => v.voteChoice === "yes").length}</span>
                                  <span className="font-medium text-red-700">No {rVotes.filter((v) => v.voteChoice === "no").length}</span>
                                  <span className="text-muted-foreground">Abstain {rVotes.filter((v) => v.voteChoice === "abstain").length}</span>
                                </div>
                                {/* Record vote form */}
                                <Form {...voteForm}>
                                  <form
                                    className="flex gap-2 flex-wrap items-end"
                                    onSubmit={voteForm.handleSubmit((v) => addVote.mutate(v))}
                                  >
                                    <FormField control={voteForm.control} name="voterPersonId" render={({ field }) => (
                                      <FormItem className="flex-1 min-w-[140px]">
                                        <FormLabel className="text-xs">Board member</FormLabel>
                                        <Select value={field.value} onValueChange={field.onChange}>
                                          <FormControl><SelectTrigger><SelectValue placeholder="Select voter" /></SelectTrigger></FormControl>
                                          <SelectContent>
                                            {(persons ?? []).map((p) => (
                                              <SelectItem key={p.id} value={p.id}>{p.firstName} {p.lastName}</SelectItem>
                                            ))}
                                          </SelectContent>
                                        </Select>
                                        <FormMessage />
                                      </FormItem>
                                    )} />
                                    <FormField control={voteForm.control} name="voteChoice" render={({ field }) => (
                                      <FormItem className="min-w-[100px]">
                                        <FormLabel className="text-xs">Vote</FormLabel>
                                        <Select value={field.value} onValueChange={field.onChange}>
                                          <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                          <SelectContent>
                                            <SelectItem value="yes">Yes</SelectItem>
                                            <SelectItem value="no">No</SelectItem>
                                            <SelectItem value="abstain">Abstain</SelectItem>
                                          </SelectContent>
                                        </Select>
                                      </FormItem>
                                    )} />
                                    <Button type="submit" size="sm" disabled={addVote.isPending} className={isMobile ? "w-full min-h-11" : undefined}>
                                      Record Vote
                                    </Button>
                                  </form>
                                </Form>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* ── Elections tab ── */}
              {activeTab === "elections" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <p className="text-sm text-muted-foreground">
                      Elections and votes linked to this meeting.
                    </p>
                    <div className="flex items-center gap-2 flex-wrap">
                      {activeAssociationId && m.meetingType === "board" && (
                        <InMeetingVoteDialog
                          meeting={m}
                          associationId={activeAssociationId}
                          persons={persons ?? []}
                          onSuccess={invalidateElections}
                        />
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5"
                        onClick={() => {
                          window.location.href = `/app/governance/elections?meetingId=${m.id}`;
                        }}
                      >
                        <Vote className="h-3.5 w-3.5" />
                        Create Election
                      </Button>
                    </div>
                  </div>

                  {linkedElections.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-2">
                      No elections linked to this meeting yet. Create a formal election or record a quick in-meeting vote above.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {linkedElections.map((election) => {
                        const statusColors: Record<string, string> = {
                          draft: "bg-gray-100 text-gray-700",
                          open: "bg-green-100 text-green-700",
                          closed: "bg-yellow-100 text-yellow-700",
                          certified: "bg-blue-100 text-blue-700",
                          cancelled: "bg-red-100 text-red-700",
                        };
                        return (
                          <div
                            key={election.id}
                            className="rounded-lg border p-3 hover:border-primary/30 transition-colors"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-medium text-sm">{election.title}</span>
                                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statusColors[election.status] ?? "bg-gray-100 text-gray-700"}`}>
                                    {election.status}
                                  </span>
                                  {election.votingRule === "board-only" && (
                                    <span className="inline-flex items-center rounded-full bg-purple-100 text-purple-700 px-2 py-0.5 text-xs font-medium">
                                      Board Only
                                    </span>
                                  )}
                                </div>
                                {election.description && (
                                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{election.description}</p>
                                )}
                              </div>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="shrink-0 gap-1 text-xs"
                                onClick={() => {
                                  window.location.href = `/app/governance/elections/${election.id}`;
                                }}
                              >
                                View Details
                                <ExternalLink className="h-3 w-3" />
                              </Button>
                            </div>
                            <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground flex-wrap">
                              <span>Eligible: {election.eligibleVoterCount}</span>
                              <span>Quorum: {election.quorumPercent}%</span>
                              {election.opensAt && <span>Opens {new Date(election.opensAt).toLocaleDateString()}</span>}
                              {election.closesAt && <span>Closes {new Date(election.closesAt).toLocaleDateString()}</span>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Status controls */}
            <div className="flex gap-2 flex-wrap px-4 pb-4 pt-2 border-t">
              <Button
                size="sm"
                variant="outline"
                disabled={updateMeeting.isPending}
                onClick={() =>
                  updateMeeting.mutate({
                    id: m.id,
                    payload: { status: m.status === "completed" ? "scheduled" : "completed" },
                  })
                }
              >
                {m.status === "completed" ? "Reopen Meeting" : "Mark as Complete"}
              </Button>
              <Button
                size="sm"
                variant={m.summaryStatus === "published" ? "outline" : "default"}
                disabled={updateMeeting.isPending}
                onClick={() =>
                  updateMeeting.mutate({
                    id: m.id,
                    payload: { summaryStatus: m.summaryStatus === "published" ? "draft" : "published" },
                  })
                }
              >
                {m.summaryStatus === "published" ? "Unpublish Minutes" : "Publish Minutes"}
              </Button>
            </div>
          </div>
        )}
      </div>
    );
  }

  function renderMeetingGroup(label: string, list: GovernanceMeeting[]) {
    if (list.length === 0) return null;
    return (
      <div className="space-y-2">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1 pb-1">
          {label}
        </div>
        {list.map((m) => renderMeetingRow(m))}
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div />
        <Dialog open={scheduleOpen} onOpenChange={setScheduleOpen}>
          <DialogTrigger asChild>
            <Button disabled={!activeAssociationId} className={isMobile ? "w-full min-h-11" : undefined}>
              Schedule Meeting
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] max-w-[calc(100vw-2rem)] overflow-y-auto sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Schedule a Meeting</DialogTitle>
              <DialogDescription>
                Adding to <strong>{activeAssociationName || "the selected association"}</strong>.
              </DialogDescription>
            </DialogHeader>
            <Form {...scheduleForm}>
              <form className="space-y-4" onSubmit={scheduleForm.handleSubmit((v) => createMeeting.mutate(v))}>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <FormField control={scheduleForm.control} name="meetingType" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Type</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="board">Board</SelectItem>
                          <SelectItem value="annual">Annual</SelectItem>
                          <SelectItem value="budget">Budget</SelectItem>
                          <SelectItem value="special">Special</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )} />
                  <FormField control={scheduleForm.control} name="scheduledAt" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Date &amp; Time</FormLabel>
                      <FormControl><Input type="datetime-local" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
                <FormField control={scheduleForm.control} name="title" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Title</FormLabel>
                    <FormControl><Input placeholder="e.g. Q1 Board Meeting" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={scheduleForm.control} name="location" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Location</FormLabel>
                    <FormControl><Input placeholder="e.g. Clubhouse, Room 2" {...field} /></FormControl>
                  </FormItem>
                )} />
                <FormField control={scheduleForm.control} name="agenda" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Agenda overview <span className="text-muted-foreground font-normal">(optional)</span></FormLabel>
                    <FormControl>
                      <Textarea rows={3} placeholder="Brief outline of topics to be covered…" {...field} />
                    </FormControl>
                  </FormItem>
                )} />
                <DialogFooter>
                  <Button variant="outline" type="button" onClick={() => setScheduleOpen(false)}>Cancel</Button>
                  <Button type="submit" disabled={createMeeting.isPending}>Schedule</Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Meeting list */}
      {!activeAssociationId ? (
        <Card>
          <CardContent className="p-10 text-center text-muted-foreground">
            Select an association to view and manage meetings.
          </CardContent>
        </Card>
      ) : (meetings ?? []).length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title="No meetings scheduled yet"
          description="Schedule a board, annual, or special meeting to start tracking agendas, attendance, and resolutions."
          testId="empty-meetings"
        />
      ) : (
        <div className="space-y-6">
          {renderMeetingGroup("Upcoming & In Progress", activeMeetings)}
          {renderMeetingGroup("Completed", completedMeetings)}
        </div>
      )}

      {/* Reminder Automation */}
      <div className="rounded-lg border overflow-hidden">
        <button
          className="w-full flex items-center justify-between p-4 text-left hover:bg-muted/20 transition-colors"
          onClick={() => setRemindersExpanded((v) => !v)}
        >
          <div className="flex items-center gap-3">
            <Settings2 className="h-4 w-4 text-muted-foreground shrink-0" />
            <div>
              <div className="text-sm font-medium flex items-center gap-2">
                Reminder Automation
                {reminderRules.length > 0 && (
                  <Badge variant="secondary">{reminderRules.length} rule{reminderRules.length !== 1 ? "s" : ""}</Badge>
                )}
              </div>
              <div className="text-xs text-muted-foreground">
                Automated notices sent to owners and board members before or after meetings
              </div>
            </div>
          </div>
          {remindersExpanded
            ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
            : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
          }
        </button>

        {remindersExpanded && (
          <div className="border-t p-4 space-y-4">
            <div className="flex justify-end">
              <Dialog open={reminderOpen} onOpenChange={setReminderOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" disabled={!activeAssociationId}>Add Rule</Button>
                </DialogTrigger>
                <DialogContent className="max-h-[90vh] max-w-[calc(100vw-2rem)] overflow-y-auto sm:max-w-lg">
                  <DialogHeader>
                    <DialogTitle>New Reminder Rule</DialogTitle>
                    <DialogDescription>
                      Rules automatically dispatch notices on a schedule relative to meeting dates.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium">Rule name</label>
                      <Input
                        placeholder="e.g. 3-day owner notice"
                        value={reminderForm.name}
                        onChange={(e) => setReminderForm((f) => ({ ...f, name: e.target.value }))}
                      />
                    </div>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <label className="text-sm font-medium">Trigger</label>
                        <Select
                          value={reminderForm.trigger}
                          onValueChange={(v) => setReminderForm((f) => ({ ...f, trigger: v as typeof f.trigger }))}
                        >
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="before_meeting">Before meeting</SelectItem>
                            <SelectItem value="after_meeting">After meeting</SelectItem>
                            <SelectItem value="task_due">Task due</SelectItem>
                            <SelectItem value="board_term_expiry">Board term expiry</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-sm font-medium">Send to</label>
                        <Select
                          value={reminderForm.recipientType}
                          onValueChange={(v) => setReminderForm((f) => ({ ...f, recipientType: v as typeof f.recipientType }))}
                        >
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all_owners">All owners</SelectItem>
                            <SelectItem value="board_members">Board members</SelectItem>
                            <SelectItem value="managers">Managers</SelectItem>
                            <SelectItem value="meeting_attendees">Meeting attendees</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <label className="text-sm font-medium">Days offset</label>
                        <Input
                          type="number"
                          min={1}
                          value={reminderForm.daysOffset}
                          onChange={(e) => setReminderForm((f) => ({ ...f, daysOffset: parseInt(e.target.value) || 3 }))}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-sm font-medium">Meeting types</label>
                        <Input
                          placeholder="board, annual (blank = all)"
                          value={reminderForm.meetingTypes}
                          onChange={(e) => setReminderForm((f) => ({ ...f, meetingTypes: e.target.value }))}
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium">Subject template</label>
                      <Input
                        placeholder="Reminder: {{meeting_title}} on {{meeting_date}}"
                        value={reminderForm.subjectTemplate}
                        onChange={(e) => setReminderForm((f) => ({ ...f, subjectTemplate: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium">Body template</label>
                      <Textarea
                        rows={4}
                        placeholder="Dear Owner, this is a reminder that…"
                        value={reminderForm.bodyTemplate}
                        onChange={(e) => setReminderForm((f) => ({ ...f, bodyTemplate: e.target.value }))}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setReminderOpen(false)}>Cancel</Button>
                    <Button
                      onClick={() => createReminderRule.mutate()}
                      disabled={
                        !reminderForm.name ||
                        !reminderForm.subjectTemplate ||
                        !reminderForm.bodyTemplate ||
                        createReminderRule.isPending
                      }
                    >
                      Create Rule
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            {reminderRules.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No reminder rules yet. Rules automatically send notices to owners and board members based on meeting timing.
              </p>
            ) : (
              <div className="space-y-2">
                {reminderRules.map((rule) => (
                  <div key={rule.id} className="flex items-center justify-between gap-3 rounded-lg border p-3 flex-wrap">
                    <div className="min-w-0">
                      <div className="text-sm font-medium">{rule.name}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {rule.trigger.replace(/_/g, " ")} · {rule.daysOffset}d offset · to {rule.recipientType.replace(/_/g, " ")}
                        {rule.lastRunAt ? ` · Last run ${new Date(rule.lastRunAt).toLocaleDateString()}` : ""}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant={rule.isActive ? "default" : "secondary"}>
                        {rule.isActive ? "Active" : "Paused"}
                      </Badge>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => runReminderRule.mutate(rule.id)}
                        disabled={!rule.isActive || runReminderRule.isPending}
                      >
                        Run
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => toggleReminderRule.mutate({ id: rule.id, isActive: rule.isActive ? 0 : 1 })}
                      >
                        {rule.isActive ? "Pause" : "Resume"}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}

export default function MeetingsPage() {
  return (
    // Wave 23 a11y: section + aria-labelledby (heading id below).
    <section className="p-6 space-y-6" aria-labelledby="meetings-heading">
      <WorkspacePageHeader
        title={t("meetings.title")}
        headingId="meetings-heading"
        summary={t("meetings.summary")}
        eyebrow={t("common.eyebrow.governance")}
        breadcrumbs={[
          { label: t("common.crumb.board"), href: "/app/board" },
          { label: t("meetings.crumb") },
        ]}
        subPages={boardGovernanceSubPages}
      />
      <MeetingsContent />
    </section>
  );
}
