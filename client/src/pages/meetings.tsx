import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import type { Association, GovernanceMeeting, MeetingAgendaItem, MeetingNote, Person, Resolution, VoteRecord } from "@shared/schema";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useActiveAssociation } from "@/hooks/use-active-association";
import { useIsMobile } from "@/hooks/use-mobile";
import { Send, Users, FileText, CheckSquare, Square } from "lucide-react";
import type { GovernanceReminderRule } from "@shared/schema";

const schema = z.object({
  associationId: z.string().min(1),
  meetingType: z.string().min(1),
  title: z.string().min(1),
  scheduledAt: z.string().min(1),
  location: z.string().optional(),
  agenda: z.string().optional(),
  notes: z.string().optional(),
});

const noteSchema = z.object({
  notes: z.string().optional(),
  summaryText: z.string().optional(),
});

const agendaItemSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  orderIndex: z.coerce.number().int().min(0),
});

const resolutionSchema = z.object({
  associationId: z.string().min(1),
  meetingId: z.string().optional(),
  title: z.string().min(1),
  description: z.string().optional(),
});

const voteSchema = z.object({
  voterPersonId: z.string().min(1, "Voter is required"),
  voteChoice: z.enum(["yes", "no", "abstain"]),
  voteWeight: z.coerce.number().positive().default(1),
});

function MobileDesktopHandoff({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-3 text-sm text-amber-900">
      <div className="font-medium">{title}</div>
      <div className="mt-1 text-xs leading-5 text-amber-800">{body}</div>
    </div>
  );
}

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
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const formattedTime = meetingDate.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });

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
    ...(meeting.agenda
      ? [`Agenda:\n${meeting.agenda}`, ``]
      : []),
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
      toast({
        title: "Meeting notice sent",
        description: `Notice sent to ${result.recipientCount ?? "all"} recipients`,
      });
      setOpen(false);
    },
    onError: (err: Error) =>
      toast({ title: "Send failed", description: err.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="icon" variant="outline" title="Send Notice">
          <Send className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto sm:max-h-[85vh]">
        <DialogHeader>
          <DialogTitle>Send Meeting Notice</DialogTitle>
          <DialogDescription>
            Send a formal meeting notice to residents. Edit the message below before sending.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg border bg-muted/20 p-3 text-sm space-y-1">
            <div><span className="text-muted-foreground">Meeting: </span><strong>{meeting.title}</strong></div>
            <div><span className="text-muted-foreground">Date: </span>{formattedDate} at {formattedTime}</div>
            {meeting.location && <div><span className="text-muted-foreground">Location: </span>{meeting.location}</div>}
          </div>

          <div className="space-y-1.5">
            <Label>Send to</Label>
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
            <Label>Subject</Label>
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label>Message</Label>
            <Textarea rows={10} value={body} onChange={(e) => setBody(e.target.value)} className="font-mono text-xs" />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button
            onClick={() => sendMutation.mutate()}
            disabled={sendMutation.isPending || !subject.trim() || !body.trim()}
          >
            {sendMutation.isPending ? "Sending…" : "Send Notice"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function QuorumDialog({
  meeting,
  persons,
}: {
  meeting: GovernanceMeeting;
  persons: Person[];
}) {
  const [open, setOpen] = useState(false);
  const [present, setPresent] = useState<Set<string>>(new Set());

  const total = persons.length;
  const presentCount = present.size;
  const quorumThreshold = Math.ceil(total / 2);
  const quorumMet = presentCount >= quorumThreshold;

  function toggle(id: string) {
    setPresent((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="icon" variant="outline" title="Attendance">
          <Users className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto sm:max-h-[85vh]">
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

export default function MeetingsPage() {
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [selectedMeeting, setSelectedMeeting] = useState<GovernanceMeeting | null>(null);
  const [selectedResolutionId, setSelectedResolutionId] = useState("");
  const [resolutionSearch, setResolutionSearch] = useState("");
  const [reminderOpen, setReminderOpen] = useState(false);
  const [reminderForm, setReminderForm] = useState({
    name: "", trigger: "before_meeting" as "before_meeting" | "after_meeting" | "task_due" | "board_term_expiry",
    daysOffset: 3, recipientType: "all_owners" as "all_owners" | "board_members" | "managers" | "meeting_attendees",
    subjectTemplate: "", bodyTemplate: "", meetingTypes: "", isActive: 1,
  });
  const { activeAssociationId, activeAssociationName } = useActiveAssociation();
  const meetingsQueryKey = activeAssociationId
    ? `/api/governance/meetings?associationId=${activeAssociationId}`
    : "/api/governance/meetings";
  const resolutionsQueryKey = activeAssociationId
    ? `/api/governance/resolutions?associationId=${activeAssociationId}`
    : "/api/governance/resolutions";
  const personsQueryKey = activeAssociationId
    ? `/api/persons?associationId=${activeAssociationId}`
    : "/api/persons";

  const { data: associations } = useQuery<Association[]>({ queryKey: ["/api/associations"] });
  const { data: meetings } = useQuery<GovernanceMeeting[]>({ queryKey: [meetingsQueryKey], enabled: Boolean(activeAssociationId) });
  const { data: persons } = useQuery<Person[]>({ queryKey: [personsQueryKey], enabled: Boolean(activeAssociationId) });
  const { data: agendaItems } = useQuery<MeetingAgendaItem[]>({
    queryKey: ["/api/governance/meetings", selectedMeeting?.id || "none", "agenda-items"],
    queryFn: async () => {
      if (!selectedMeeting) return [];
      const res = await apiRequest("GET", `/api/governance/meetings/${selectedMeeting.id}/agenda-items`);
      return res.json();
    },
    enabled: Boolean(selectedMeeting),
  });
  const { data: meetingNotes } = useQuery<MeetingNote[]>({
    queryKey: ["/api/governance/meetings", selectedMeeting?.id || "none", "notes"],
    queryFn: async () => {
      if (!selectedMeeting) return [];
      const res = await apiRequest("GET", `/api/governance/meetings/${selectedMeeting.id}/notes`);
      return res.json();
    },
    enabled: Boolean(selectedMeeting),
  });
  const { data: resolutions } = useQuery<Resolution[]>({ queryKey: [resolutionsQueryKey], enabled: Boolean(activeAssociationId) });
  const { data: votes } = useQuery<VoteRecord[]>({
    queryKey: ["/api/governance/resolutions", selectedResolutionId || "none", "votes"],
    queryFn: async () => {
      if (!selectedResolutionId) return [];
      const res = await apiRequest("GET", `/api/governance/resolutions/${selectedResolutionId}/votes`);
      return res.json();
    },
    enabled: Boolean(selectedResolutionId),
  });

  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: {
      associationId: "",
      meetingType: "board",
      title: "",
      scheduledAt: "",
      location: "",
      agenda: "",
      notes: "",
    },
  });

  const noteForm = useForm<z.infer<typeof noteSchema>>({
    resolver: zodResolver(noteSchema),
    defaultValues: { notes: "", summaryText: "" },
  });
  const agendaForm = useForm<z.infer<typeof agendaItemSchema>>({
    resolver: zodResolver(agendaItemSchema),
    defaultValues: { title: "", description: "", orderIndex: 0 },
  });
  const resolutionForm = useForm<z.infer<typeof resolutionSchema>>({
    resolver: zodResolver(resolutionSchema),
    defaultValues: { associationId: "", meetingId: "", title: "", description: "" },
  });
  const voteForm = useForm<z.infer<typeof voteSchema>>({
    resolver: zodResolver(voteSchema),
    defaultValues: { voterPersonId: "", voteChoice: "yes", voteWeight: 1 },
  });

  useEffect(() => {
    form.setValue("associationId", activeAssociationId, { shouldValidate: true });
    resolutionForm.setValue("associationId", activeAssociationId, { shouldValidate: true });
    setSelectedMeeting(null);
    setSelectedResolutionId("");
  }, [activeAssociationId, form, resolutionForm]);

  const createMeeting = useMutation({
    mutationFn: async (v: z.infer<typeof schema>) => {
      const res = await apiRequest("POST", "/api/governance/meetings", {
        associationId: v.associationId,
        meetingType: v.meetingType,
        title: v.title,
        scheduledAt: new Date(v.scheduledAt).toISOString(),
        location: v.location || null,
        agenda: v.agenda || null,
        notes: v.notes || null,
        status: "scheduled",
        summaryStatus: "draft",
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        predicate: (query) => String(query.queryKey[0] ?? "").startsWith("/api/governance/meetings"),
      });
      setOpen(false);
      form.reset({ associationId: activeAssociationId, meetingType: "board", title: "", scheduledAt: "", location: "", agenda: "", notes: "" });
      toast({ title: "Meeting scheduled" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const updateMeeting = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: Record<string, unknown> }) => {
      const res = await apiRequest("PATCH", `/api/governance/meetings/${id}`, payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        predicate: (query) => String(query.queryKey[0] ?? "").startsWith("/api/governance/meetings"),
      });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });
  const addAgendaItem = useMutation({
    mutationFn: async (v: z.infer<typeof agendaItemSchema>) => {
      if (!selectedMeeting) throw new Error("Select a meeting first");
      const res = await apiRequest("POST", `/api/governance/meetings/${selectedMeeting.id}/agenda-items`, v);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/governance/meetings", selectedMeeting?.id || "none", "agenda-items"] });
      agendaForm.reset();
      toast({ title: "Agenda item added" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });
  const addMeetingNote = useMutation({
    mutationFn: async (content: string) => {
      if (!selectedMeeting) throw new Error("Select a meeting first");
      const res = await apiRequest("POST", `/api/governance/meetings/${selectedMeeting.id}/notes`, { content, noteType: "minutes" });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/governance/meetings", selectedMeeting?.id || "none", "notes"] });
      toast({ title: "Meeting note added" });
    },
  });
  const addResolution = useMutation({
    mutationFn: async (v: z.infer<typeof resolutionSchema>) => {
      const res = await apiRequest("POST", "/api/governance/resolutions", {
        associationId: v.associationId,
        meetingId: v.meetingId || null,
        title: v.title,
        description: v.description || null,
        status: "open",
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        predicate: (query) => String(query.queryKey[0] ?? "").startsWith("/api/governance/resolutions"),
      });
      resolutionForm.reset({ associationId: activeAssociationId, meetingId: "", title: "", description: "" });
      toast({ title: "Resolution created" });
    },
  });
  const addVote = useMutation({
    mutationFn: async (v: z.infer<typeof voteSchema>) => {
      if (!selectedResolutionId) throw new Error("Select resolution first");
      const res = await apiRequest("POST", `/api/governance/resolutions/${selectedResolutionId}/votes`, {
        voterPersonId: v.voterPersonId || null,
        voteChoice: v.voteChoice,
        voteWeight: v.voteWeight,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/governance/resolutions", selectedResolutionId, "votes"] });
      queryClient.invalidateQueries({
        predicate: (query) => String(query.queryKey[0] ?? "").startsWith("/api/governance/resolutions"),
      });
      voteForm.reset({ voterPersonId: "", voteChoice: "yes", voteWeight: 1 });
      toast({ title: "Vote recorded (starter workflow)" });
    },
  });

  const seedSampleData = useMutation({
    mutationFn: async () => {
      if (!activeAssociationId) throw new Error("Select an association first");
      const meetingRes = await apiRequest("POST", "/api/governance/meetings", {
        associationId: activeAssociationId,
        meetingType: "board",
        title: "Sample Board Meeting",
        scheduledAt: new Date().toISOString(),
        location: "Conference Room A",
        agenda: "Approve prior minutes, review budget variance, and discuss maintenance priorities.",
        notes: "Sample meeting seeded for walkthrough.",
        status: "scheduled",
        summaryStatus: "draft",
      });
      const meeting = await meetingRes.json();
      const resolutionRes = await apiRequest("POST", "/api/governance/resolutions", {
        associationId: activeAssociationId,
        meetingId: meeting.id,
        title: "Sample Resolution: Approve Q2 Maintenance Plan",
        description: "This sample resolution demonstrates vote capture and tally updates.",
        status: "open",
      });
      const resolution = await resolutionRes.json();
      return { meeting, resolution };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({
        predicate: (query) => String(query.queryKey[0] ?? "").startsWith("/api/governance/meetings"),
      });
      queryClient.invalidateQueries({
        predicate: (query) => String(query.queryKey[0] ?? "").startsWith("/api/governance/resolutions"),
      });
      setSelectedMeeting(result.meeting);
      setSelectedResolutionId(result.resolution.id);
      toast({ title: "Sample governance records created" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  // Generate sequential resolution reference numbers R-{year}-{seq}
  const resolutionNumbers = useMemo(() => {
    const sorted = [...(resolutions ?? [])].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    const map = new Map<string, string>();
    const yearCounters: Record<string, number> = {};
    for (const r of sorted) {
      const year = new Date(r.createdAt).getFullYear();
      yearCounters[year] = (yearCounters[year] ?? 0) + 1;
      map.set(r.id, `R-${year}-${String(yearCounters[year]).padStart(3, "0")}`);
    }
    return map;
  }, [resolutions]);

  const filteredResolutions = useMemo(() => {
    const list = resolutions ?? [];
    if (!resolutionSearch.trim()) return list;
    const q = resolutionSearch.toLowerCase();
    return list.filter((r) => {
      const meetingTitle = meetings?.find((m) => m.id === r.meetingId)?.title || "";
      const meetingDate = meetings?.find((m) => m.id === r.meetingId)?.scheduledAt
        ? new Date(meetings.find((m) => m.id === r.meetingId)!.scheduledAt).toLocaleDateString()
        : "";
      return (
        r.title.toLowerCase().includes(q) ||
        (r.description || "").toLowerCase().includes(q) ||
        meetingTitle.toLowerCase().includes(q) ||
        meetingDate.toLowerCase().includes(q)
      );
    });
  }, [resolutions, resolutionSearch, meetings]);

  const selectedResolution = useMemo(
    () => (resolutions ?? []).find((resolution) => resolution.id === selectedResolutionId) ?? null,
    [resolutions, selectedResolutionId],
  );

  const selectedResolutionMeeting = useMemo(
    () => meetings?.find((meeting) => meeting.id === selectedResolution?.meetingId) ?? null,
    [meetings, selectedResolution],
  );

  const { data: reminderRules = [], refetch: refetchReminderRules } = useQuery<GovernanceReminderRule[]>({
    queryKey: ["/api/governance/reminder-rules", activeAssociationId],
    queryFn: async () => {
      if (!activeAssociationId) return [];
      const res = await apiRequest("GET", `/api/governance/reminder-rules?associationId=${activeAssociationId}`);
      return res.json();
    },
    enabled: Boolean(activeAssociationId),
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
      setReminderForm({ name: "", trigger: "before_meeting", daysOffset: 3, recipientType: "all_owners", subjectTemplate: "", bodyTemplate: "", meetingTypes: "", isActive: 1 });
      toast({ title: "Reminder rule created" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const runReminderRule = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("POST", `/api/governance/reminder-rules/${id}/run`);
      return res.json();
    },
    onSuccess: (data: { sent: number; meetings: number }) => {
      toast({ title: `Reminders sent`, description: `${data.sent} notices dispatched for ${data.meetings} meeting(s)` });
    },
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

  function openNoteEditor(meeting: GovernanceMeeting) {
    setSelectedMeeting(meeting);
    noteForm.reset({ notes: meeting.notes || "", summaryText: meeting.summaryText || "" });
    setNoteOpen(true);
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Meetings</h1>
          <p className="text-muted-foreground">Schedule meeting records, capture notes, and publish summaries in the current association context.</p>
        </div>
        <div className="flex gap-2">
          {(meetings?.length ?? 0) === 0 ? (
            <Button
              variant="outline"
              disabled={!activeAssociationId || seedSampleData.isPending}
              onClick={() => seedSampleData.mutate()}
            >
              {seedSampleData.isPending ? "Seeding..." : "Load Sample Data"}
            </Button>
          ) : null}
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button disabled={!activeAssociationId}>Schedule Meeting</Button></DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto sm:max-h-[85vh]">
              <DialogHeader><DialogTitle>Schedule Meeting</DialogTitle></DialogHeader>
              <Form {...form}>
                <form className="space-y-4" onSubmit={form.handleSubmit((v) => createMeeting.mutate(v))}>
                  <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm">
                    Association Context: <span className="font-medium">{activeAssociationName || "None selected"}</span>
                  </div>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <FormField control={form.control} name="meetingType" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Meeting Type</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                          <SelectContent>
                            <SelectItem value="board">Board meeting</SelectItem>
                            <SelectItem value="annual">Annual meeting</SelectItem>
                            <SelectItem value="budget">Budget meeting</SelectItem>
                            <SelectItem value="special">Special meeting</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="scheduledAt" render={({ field }) => (
                      <FormItem><FormLabel>Meeting Date</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                  </div>
                  <FormField control={form.control} name="title" render={({ field }) => (<FormItem><FormLabel>Title</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                  <FormField control={form.control} name="location" render={({ field }) => (<FormItem><FormLabel>Location</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                  <FormField control={form.control} name="agenda" render={({ field }) => (<FormItem><FormLabel>Agenda</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem>)} />
                  <Button className="w-full" type="submit" disabled={createMeeting.isPending}>Save</Button>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card>
        <CardContent className="p-6 space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-medium">Meeting Agenda Items</h2>
                  <p className="text-xs text-muted-foreground">
                    {selectedMeeting ? `Editing agenda for ${selectedMeeting.title}.` : "Select a meeting first to add agenda items."}
                  </p>
                </div>
                {selectedMeeting ? <Badge variant="outline">{selectedMeeting.meetingType}</Badge> : null}
              </div>
              <Form {...agendaForm}>
                <form className="grid grid-cols-1 gap-2 md:grid-cols-4" onSubmit={agendaForm.handleSubmit((v) => addAgendaItem.mutate(v))}>
                  <Input placeholder="Agenda title" value={agendaForm.watch("title")} onChange={(e) => agendaForm.setValue("title", e.target.value)} />
                  <Input placeholder="Description" value={agendaForm.watch("description") || ""} onChange={(e) => agendaForm.setValue("description", e.target.value)} />
                  <div className="space-y-1">
                    <Input type="number" placeholder="Agenda order" value={agendaForm.watch("orderIndex")} onChange={(e) => agendaForm.setValue("orderIndex", Number(e.target.value))} />
                    <div className="text-xs text-muted-foreground">Use 0 for the first item, 1 for the second, and so on.</div>
                  </div>
                  <Button type="submit" disabled={!selectedMeeting || addAgendaItem.isPending}>Add Agenda Item</Button>
                </form>
              </Form>
              <div className="space-y-1">
                {(agendaItems ?? []).map((item) => (
                  <div key={item.id} className="rounded border p-2 text-sm">
                    <div className="font-medium">{item.orderIndex + 1}. {item.title}</div>
                    <div className="text-muted-foreground">{item.description || "No description"}</div>
                  </div>
                ))}
                {!agendaItems?.length ? (
                  <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
                    {selectedMeeting ? "No agenda items added yet for this meeting." : "Select a meeting below to manage its agenda."}
                  </div>
                ) : null}
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-medium">Meeting Notes Log</h2>
                  <p className="text-xs text-muted-foreground">
                    {selectedMeeting ? "Capture rough minute entries before publishing a summary." : "Pick a meeting to review notes and minute snapshots."}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!selectedMeeting}
                  onClick={() => addMeetingNote.mutate(`Minute entry ${new Date().toISOString()}`)}
                >
                  Add Minute Snapshot
                </Button>
              </div>
              <div className="space-y-1">
                {(meetingNotes ?? []).map((note) => (
                  <div key={note.id} className="rounded border p-2 text-sm">
                    <div>{note.content}</div>
                    <div className="text-xs text-muted-foreground">{new Date(note.createdAt).toLocaleString()}</div>
                  </div>
                ))}
                {!meetingNotes?.length ? (
                  <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
                    {selectedMeeting ? "No minute snapshots logged for this meeting yet." : "Select a meeting below to review or add minute snapshots."}
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <div className="hidden md:block">
            <Table>
              <TableHeader><TableRow><TableHead>Title</TableHead><TableHead>Type</TableHead><TableHead>Date</TableHead><TableHead>Status</TableHead><TableHead>Summary</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader>
              <TableBody>
                {(meetings ?? []).map((m) => (
                  <TableRow key={m.id} className={selectedMeeting?.id === m.id ? "bg-primary/5" : undefined}>
                    <TableCell>{m.title}</TableCell>
                    <TableCell><Badge variant="secondary">{m.meetingType}</Badge></TableCell>
                    <TableCell>{new Date(m.scheduledAt).toLocaleDateString()}</TableCell>
                    <TableCell><Badge variant="outline">{m.status}</Badge></TableCell>
                    <TableCell><Badge variant={m.summaryStatus === "published" ? "default" : "outline"}>{m.summaryStatus}</Badge></TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1.5">
                        {activeAssociationId && (
                          <MeetingNoticeDialog
                            meeting={m}
                            associationId={activeAssociationId}
                            associationName={activeAssociationName}
                          />
                        )}
                        <QuorumDialog meeting={m} persons={persons ?? []} />
                        <Button size="sm" variant={selectedMeeting?.id === m.id ? "default" : "secondary"} onClick={() => setSelectedMeeting(m)}>
                          {selectedMeeting?.id === m.id ? "Selected" : "Use For Agenda"}
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => openNoteEditor(m)}>Edit Notes</Button>
                        <Button size="sm" variant="outline" onClick={() => updateMeeting.mutate({ id: m.id, payload: { status: m.status === "completed" ? "in-progress" : "completed" } })}>
                          {m.status === "completed" ? "Reopen" : "Complete"}
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => updateMeeting.mutate({ id: m.id, payload: { summaryStatus: m.summaryStatus === "published" ? "draft" : "published" } })}>
                          {m.summaryStatus === "published" ? "Unpublish" : "Publish Summary"}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {(meetings ?? []).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-14 text-center text-muted-foreground">
                      No meetings scheduled yet.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </div>
          <div className="space-y-3 p-4 md:hidden">
            {(meetings ?? []).map((m) => (
              <div key={m.id} className="rounded-xl border p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-medium">{m.title}</div>
                    <div className="mt-1 text-xs text-muted-foreground">{new Date(m.scheduledAt).toLocaleDateString()}</div>
                  </div>
                  <Badge variant="secondary">{m.meetingType}</Badge>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">{m.status}</Badge>
                  <Badge variant={m.summaryStatus === "published" ? "default" : "outline"}>{m.summaryStatus}</Badge>
                </div>
                <div className="grid grid-cols-1 gap-2">
                  <div className="flex flex-wrap gap-2">
                    {activeAssociationId && (
                      <MeetingNoticeDialog
                        meeting={m}
                        associationId={activeAssociationId}
                        associationName={activeAssociationName}
                      />
                    )}
                    <QuorumDialog meeting={m} persons={persons ?? []} />
                    <Button size="sm" variant="outline" onClick={() => openNoteEditor(m)}>Edit Notes</Button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Button size="sm" variant="outline" onClick={() => updateMeeting.mutate({ id: m.id, payload: { status: m.status === "completed" ? "in-progress" : "completed" } })}>
                      {m.status === "completed" ? "Reopen" : "Complete"}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => updateMeeting.mutate({ id: m.id, payload: { summaryStatus: m.summaryStatus === "published" ? "draft" : "published" } })}>
                      {m.summaryStatus === "published" ? "Unpublish" : "Publish Summary"}
                    </Button>
                  </div>
                  <Button
                    size="sm"
                    variant={selectedMeeting?.id === m.id ? "default" : "secondary"}
                    onClick={() => setSelectedMeeting(m)}
                  >
                    {selectedMeeting?.id === m.id ? "Selected For Agenda & Notes" : "Use For Agenda & Notes"}
                  </Button>
                </div>
              </div>
            ))}
            {(meetings ?? []).length === 0 ? (
              <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
                No meetings scheduled yet. Create one above or load sample data to review the mobile workflow.
              </div>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <h2 className="text-lg font-semibold">Decisions & Starter Vote Tracking</h2>
              <p className="text-xs text-muted-foreground">Keep one selected resolution active, then record votes against that decision.</p>
            </div>
            <Input
              className="max-w-sm"
              placeholder="Search by title, meeting, or date"
              value={resolutionSearch}
              onChange={(e) => setResolutionSearch(e.target.value)}
            />
          </div>

          <Form {...resolutionForm}>
            <form className="grid grid-cols-1 gap-2 md:grid-cols-4" onSubmit={resolutionForm.handleSubmit((v) => addResolution.mutate(v))}>
              <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm flex items-center">
                <span className="font-medium">{activeAssociationName || "None selected"}</span>
              </div>
              <Select value={resolutionForm.watch("meetingId") || "none"} onValueChange={(v) => resolutionForm.setValue("meetingId", v === "none" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Meeting (optional)" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">no meeting</SelectItem>
                  {(meetings ?? []).map((m) => <SelectItem key={m.id} value={m.id}>{m.title}</SelectItem>)}
                </SelectContent>
              </Select>
              <Input placeholder="Resolution title" value={resolutionForm.watch("title")} onChange={(e) => resolutionForm.setValue("title", e.target.value)} />
              <Button type="submit" disabled={addResolution.isPending}>Create Resolution</Button>
            </form>
          </Form>

          <div className="rounded-xl border bg-muted/20 p-4 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Active Decision</div>
                {selectedResolution ? (
                  <>
                    <div className="mt-1 text-sm font-semibold">{selectedResolution.title}</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {resolutionNumbers.get(selectedResolution.id) || "—"}
                      {selectedResolutionMeeting ? ` · ${selectedResolutionMeeting.title}` : " · No linked meeting"}
                      {selectedResolutionMeeting?.scheduledAt ? ` · ${new Date(selectedResolutionMeeting.scheduledAt).toLocaleDateString()}` : ""}
                    </div>
                    {selectedResolution.description ? (
                      <div className="mt-2 text-sm text-muted-foreground">{selectedResolution.description}</div>
                    ) : null}
                  </>
                ) : (
                  <div className="mt-1 text-sm text-muted-foreground">
                    Select a resolution below before recording votes or reviewing its status.
                  </div>
                )}
              </div>
              {selectedResolution ? (
                <Badge variant={selectedResolution.status === "approved" ? "default" : selectedResolution.status === "rejected" ? "destructive" : "secondary"}>
                  {selectedResolution.status}
                </Badge>
              ) : null}
            </div>
            <div className="flex gap-2 flex-wrap">
              <Badge variant="secondary">Votes: {(votes ?? []).length}</Badge>
              <Badge variant="outline">Yes: {(votes ?? []).filter((v) => v.voteChoice === "yes").length}</Badge>
              <Badge variant="outline">No: {(votes ?? []).filter((v) => v.voteChoice === "no").length}</Badge>
              <Badge variant="outline">Abstain: {(votes ?? []).filter((v) => v.voteChoice === "abstain").length}</Badge>
            </div>
          </div>

          <div className="hidden md:block">
            <Table>
              <TableHeader><TableRow><TableHead className="w-24">Ref #</TableHead><TableHead>Resolution</TableHead><TableHead>Meeting</TableHead><TableHead>Date</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
              <TableBody>
                {filteredResolutions.map((r) => {
                  const meeting = meetings?.find((m) => m.id === r.meetingId);
                  return (
                    <TableRow key={r.id} onClick={() => setSelectedResolutionId(r.id)} className={`cursor-pointer ${r.id === selectedResolutionId ? "bg-primary/5 ring-1 ring-inset ring-primary" : ""}`}>
                      <TableCell><code className="text-xs font-mono text-muted-foreground">{resolutionNumbers.get(r.id) || "—"}</code></TableCell>
                      <TableCell>{r.title}</TableCell>
                      <TableCell>{meeting?.title || "-"}</TableCell>
                      <TableCell>{meeting?.scheduledAt ? new Date(meeting.scheduledAt).toLocaleDateString() : "-"}</TableCell>
                      <TableCell><Badge variant={r.status === "approved" ? "default" : r.status === "rejected" ? "destructive" : "secondary"}>{r.status}</Badge></TableCell>
                    </TableRow>
                  );
                })}
                {filteredResolutions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-14 text-center text-muted-foreground">
                      No resolutions match the current search.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </div>
          <div className="space-y-3 md:hidden">
            {filteredResolutions.map((r) => {
              const meeting = meetings?.find((m) => m.id === r.meetingId);
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setSelectedResolutionId(r.id)}
                  className={`w-full rounded-xl border p-4 text-left ${r.id === selectedResolutionId ? "bg-primary/5 ring-1 ring-inset ring-primary" : ""}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-mono text-xs text-muted-foreground">{resolutionNumbers.get(r.id) || "—"}</div>
                      <div className="mt-1 text-sm font-medium">{r.title}</div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {meeting?.title || "No meeting"}
                        {meeting?.scheduledAt ? ` · ${new Date(meeting.scheduledAt).toLocaleDateString()}` : ""}
                      </div>
                    </div>
                    <Badge variant={r.status === "approved" ? "default" : r.status === "rejected" ? "destructive" : "secondary"}>{r.status}</Badge>
                  </div>
                </button>
              );
            })}
            {filteredResolutions.length === 0 ? (
              <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
                No resolutions match the current search or meeting filter.
              </div>
            ) : null}
          </div>

          <div className="grid grid-cols-1 gap-2 md:grid-cols-4">
              <Select value={voteForm.watch("voterPersonId")} onValueChange={(v) => voteForm.setValue("voterPersonId", v)}>
                <SelectTrigger className={isMobile ? "min-h-11" : undefined}><SelectValue placeholder="Board voter" /></SelectTrigger>
                <SelectContent>
                  {(persons ?? []).map((p) => <SelectItem key={p.id} value={p.id}>{p.firstName} {p.lastName}</SelectItem>)}
                </SelectContent>
              </Select>
            <Select value={voteForm.watch("voteChoice")} onValueChange={(v) => voteForm.setValue("voteChoice", v as "yes" | "no" | "abstain")}>
              <SelectTrigger className={isMobile ? "min-h-11" : undefined}><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="yes">yes</SelectItem>
                <SelectItem value="no">no</SelectItem>
                <SelectItem value="abstain">abstain</SelectItem>
              </SelectContent>
            </Select>
            <Input className={isMobile ? "min-h-11" : undefined} type="number" step="0.1" value={voteForm.watch("voteWeight")} onChange={(e) => voteForm.setValue("voteWeight", Number(e.target.value))} />
            <Button className={isMobile ? "min-h-11" : undefined} disabled={!selectedResolutionId || addVote.isPending} onClick={voteForm.handleSubmit((v) => addVote.mutate(v))}>Record Vote</Button>
          </div>
        </CardContent>
      </Card>

      <Dialog open={noteOpen} onOpenChange={setNoteOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto sm:max-h-[85vh]">
          <DialogHeader><DialogTitle>Edit Notes &amp; Minutes</DialogTitle></DialogHeader>
          <Form {...noteForm}>
            <form
              className="space-y-4"
              onSubmit={noteForm.handleSubmit((v) => {
                if (!selectedMeeting) return;
                updateMeeting.mutate({ id: selectedMeeting.id, payload: { notes: v.notes || null, summaryText: v.summaryText || null } });
                setNoteOpen(false);
              })}
            >
              {isMobile ? (
                <MobileDesktopHandoff
                  title="Desktop preferred for long-form minutes editing"
                  body="Mobile is suitable for quick note capture, status review, and summary checks. Final long-form minutes editing and formatting should still be completed on desktop."
                />
              ) : null}
              <FormField control={noteForm.control} name="notes" render={({ field }) => (
                <FormItem><FormLabel>Meeting Notes</FormLabel><FormControl><Textarea rows={5} className={isMobile ? "min-h-28" : undefined} {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <div className={`flex items-center justify-between gap-3 ${isMobile ? "flex-col items-stretch" : ""}`}>
                <FormLabel>Draft Minutes</FormLabel>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="gap-1"
                  onClick={() => {
                    if (!selectedMeeting) return;
                    const meetingDate = new Date(selectedMeeting.scheduledAt);
                    const formattedDate = meetingDate.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
                    const formattedTime = meetingDate.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
                    const meetingResolutions = (resolutions ?? []).filter((r) => r.meetingId === selectedMeeting.id);
                    const agendaLines = (agendaItems ?? [])
                      .sort((a, b) => a.orderIndex - b.orderIndex)
                      .map((item) => `  ${item.orderIndex + 1}. ${item.title}${item.description ? ` — ${item.description}` : ""}`)
                      .join("\n");
                    const resolutionLines = meetingResolutions
                      .map((r) => `  - ${r.title} [${r.status}]${r.description ? `\n    ${r.description}` : ""}`)
                      .join("\n");
                    const draft = [
                      `MEETING MINUTES`,
                      `================`,
                      `${activeAssociationName || "Association"}`,
                      `${selectedMeeting.meetingType.charAt(0).toUpperCase() + selectedMeeting.meetingType.slice(1)} Meeting`,
                      ``,
                      `Date: ${formattedDate}`,
                      `Time: ${formattedTime}`,
                      ...(selectedMeeting.location ? [`Location: ${selectedMeeting.location}`] : []),
                      ``,
                      `CALL TO ORDER`,
                      `The ${selectedMeeting.meetingType} meeting was called to order.`,
                      ``,
                      ...(agendaLines ? [`AGENDA\n${agendaLines}`, ``] : []),
                      ...(selectedMeeting.notes ? [`DISCUSSION\n${selectedMeeting.notes}`, ``] : []),
                      ...(resolutionLines ? [`RESOLUTIONS\n${resolutionLines}`, ``] : []),
                      `ADJOURNMENT`,
                      `There being no further business, the meeting was adjourned.`,
                      ``,
                      `_______________________________`,
                      `Secretary, ${activeAssociationName || "Association"}`,
                    ].join("\n");
                    noteForm.setValue("summaryText", draft);
                  }}
                >
                  <FileText className="h-3 w-3" />
                  Generate Draft
                </Button>
              </div>
              <FormField control={noteForm.control} name="summaryText" render={({ field }) => (
                <FormItem><FormControl><Textarea rows={12} className={`font-mono text-xs ${isMobile ? "min-h-[18rem]" : ""}`} {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <Button className="w-full" type="submit">Save</Button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Governance Reminder Cadence</h2>
              <p className="text-sm text-muted-foreground">Automated reminders sent to owners and board members before or after meetings.</p>
            </div>
            <Dialog open={reminderOpen} onOpenChange={setReminderOpen}>
              <DialogTrigger asChild>
                <Button size="sm" disabled={!activeAssociationId}>Add Rule</Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto sm:max-h-[85vh]">
                <DialogHeader><DialogTitle>New Reminder Rule</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <Input placeholder="Rule name *" value={reminderForm.name} onChange={(e) => setReminderForm((f) => ({ ...f, name: e.target.value }))} />
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <Select value={reminderForm.trigger} onValueChange={(v) => setReminderForm((f) => ({ ...f, trigger: v as typeof f.trigger }))}>
                      <SelectTrigger><SelectValue placeholder="Trigger" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="before_meeting">Before Meeting</SelectItem>
                        <SelectItem value="after_meeting">After Meeting</SelectItem>
                        <SelectItem value="task_due">Task Due</SelectItem>
                        <SelectItem value="board_term_expiry">Board Term Expiry</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={reminderForm.recipientType} onValueChange={(v) => setReminderForm((f) => ({ ...f, recipientType: v as typeof f.recipientType }))}>
                      <SelectTrigger><SelectValue placeholder="Recipients" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all_owners">All Owners</SelectItem>
                        <SelectItem value="board_members">Board Members</SelectItem>
                        <SelectItem value="managers">Managers</SelectItem>
                        <SelectItem value="meeting_attendees">Meeting Attendees</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">Days offset</label>
                      <Input type="number" min={1} value={reminderForm.daysOffset} onChange={(e) => setReminderForm((f) => ({ ...f, daysOffset: parseInt(e.target.value) || 3 }))} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">Meeting types (comma separated)</label>
                      <Input placeholder="board,annual" value={reminderForm.meetingTypes} onChange={(e) => setReminderForm((f) => ({ ...f, meetingTypes: e.target.value }))} />
                    </div>
                  </div>
                  <Input placeholder="Subject template *" value={reminderForm.subjectTemplate} onChange={(e) => setReminderForm((f) => ({ ...f, subjectTemplate: e.target.value }))} />
                  <Textarea placeholder="Body template *" rows={4} value={reminderForm.bodyTemplate} onChange={(e) => setReminderForm((f) => ({ ...f, bodyTemplate: e.target.value }))} />
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setReminderOpen(false)}>Cancel</Button>
                    <Button onClick={() => createReminderRule.mutate()} disabled={!reminderForm.name || !reminderForm.subjectTemplate || !reminderForm.bodyTemplate || createReminderRule.isPending}>
                      Create
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Trigger</TableHead>
                  <TableHead>Days</TableHead>
                  <TableHead>Recipients</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Run</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reminderRules.map((rule) => (
                  <TableRow key={rule.id}>
                    <TableCell className="font-medium">{rule.name}</TableCell>
                    <TableCell><Badge variant="outline">{rule.trigger.replace(/_/g, " ")}</Badge></TableCell>
                    <TableCell>{rule.daysOffset}d</TableCell>
                    <TableCell className="text-sm">{rule.recipientType.replace(/_/g, " ")}</TableCell>
                    <TableCell><Badge variant={rule.isActive ? "default" : "secondary"}>{rule.isActive ? "Active" : "Paused"}</Badge></TableCell>
                    <TableCell className="text-sm text-muted-foreground">{rule.lastRunAt ? new Date(rule.lastRunAt).toLocaleDateString() : "—"}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="outline" onClick={() => runReminderRule.mutate(rule.id)} disabled={!rule.isActive || runReminderRule.isPending}>Run</Button>
                        <Button size="sm" variant="outline" onClick={() => toggleReminderRule.mutate({ id: rule.id, isActive: rule.isActive ? 0 : 1 })}>
                          {rule.isActive ? "Pause" : "Resume"}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {reminderRules.length === 0 && (
                  <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground h-12">No reminder rules configured.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          <div className="space-y-3 md:hidden">
            {reminderRules.map((rule) => (
              <div key={rule.id} className="rounded-xl border p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-medium">{rule.name}</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {rule.trigger.replace(/_/g, " ")} · {rule.daysOffset}d · {rule.recipientType.replace(/_/g, " ")}
                    </div>
                  </div>
                  <Badge variant={rule.isActive ? "default" : "secondary"}>{rule.isActive ? "Active" : "Paused"}</Badge>
                </div>
                <div className="text-xs text-muted-foreground">Last run: {rule.lastRunAt ? new Date(rule.lastRunAt).toLocaleDateString() : "—"}</div>
                <div className="grid grid-cols-2 gap-2">
                  <Button size="sm" variant="outline" onClick={() => runReminderRule.mutate(rule.id)} disabled={!rule.isActive || runReminderRule.isPending}>Run</Button>
                  <Button size="sm" variant="outline" onClick={() => toggleReminderRule.mutate({ id: rule.id, isActive: rule.isActive ? 0 : 1 })}>
                    {rule.isActive ? "Pause" : "Resume"}
                  </Button>
                </div>
              </div>
            ))}
            {reminderRules.length === 0 ? (
              <div className="rounded-xl border border-dashed p-4 text-center text-sm text-muted-foreground">No reminder rules configured.</div>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
