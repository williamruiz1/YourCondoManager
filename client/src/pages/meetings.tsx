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
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useActiveAssociation } from "@/hooks/use-active-association";

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

export default function MeetingsPage() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [selectedMeeting, setSelectedMeeting] = useState<GovernanceMeeting | null>(null);
  const [selectedResolutionId, setSelectedResolutionId] = useState("");
  const [resolutionSearch, setResolutionSearch] = useState("");
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
            <DialogContent>
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
              <h2 className="text-sm font-medium">Meeting Agenda Items</h2>
              <Form {...agendaForm}>
                <form className="grid grid-cols-1 md:grid-cols-4 gap-2" onSubmit={agendaForm.handleSubmit((v) => addAgendaItem.mutate(v))}>
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
                    <div className="font-medium">{item.orderIndex}. {item.title}</div>
                    <div className="text-muted-foreground">{item.description || "No description"}</div>
                  </div>
                ))}
                {!agendaItems?.length ? <div className="text-sm text-muted-foreground">Select a meeting and add agenda items.</div> : null}
              </div>
            </div>
            <div className="space-y-3">
              <h2 className="text-sm font-medium">Meeting Notes Log</h2>
              <Button
                variant="outline"
                size="sm"
                disabled={!selectedMeeting}
                onClick={() => addMeetingNote.mutate(`Minute entry ${new Date().toISOString()}`)}
              >
                Add Minute Snapshot
              </Button>
              <div className="space-y-1">
                {(meetingNotes ?? []).map((note) => (
                  <div key={note.id} className="rounded border p-2 text-sm">
                    <div>{note.content}</div>
                    <div className="text-xs text-muted-foreground">{new Date(note.createdAt).toLocaleString()}</div>
                  </div>
                ))}
                {!meetingNotes?.length ? <div className="text-sm text-muted-foreground">No meeting notes logged for selected meeting.</div> : null}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow><TableHead>Title</TableHead><TableHead>Type</TableHead><TableHead>Date</TableHead><TableHead>Status</TableHead><TableHead>Summary</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader>
            <TableBody>
              {(meetings ?? []).map((m) => (
                <TableRow key={m.id}>
                  <TableCell>{m.title}</TableCell>
                  <TableCell><Badge variant="secondary">{m.meetingType}</Badge></TableCell>
                  <TableCell>{new Date(m.scheduledAt).toLocaleDateString()}</TableCell>
                  <TableCell><Badge variant="outline">{m.status}</Badge></TableCell>
                  <TableCell><Badge variant={m.summaryStatus === "published" ? "default" : "outline"}>{m.summaryStatus}</Badge></TableCell>
                  <TableCell className="space-x-2">
                    <Button size="sm" variant="outline" onClick={() => openNoteEditor(m)}>Edit Notes</Button>
                    <Button size="sm" variant="outline" onClick={() => updateMeeting.mutate({ id: m.id, payload: { status: m.status === "completed" ? "in-progress" : "completed" } })}>
                      {m.status === "completed" ? "Reopen" : "Complete"}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => updateMeeting.mutate({ id: m.id, payload: { summaryStatus: m.summaryStatus === "published" ? "draft" : "published" } })}>
                      {m.summaryStatus === "published" ? "Unpublish" : "Publish Summary"}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h2 className="text-lg font-semibold">Decisions & Starter Vote Tracking</h2>
            <Input
              className="max-w-sm"
              placeholder="Search by title, meeting, or date"
              value={resolutionSearch}
              onChange={(e) => setResolutionSearch(e.target.value)}
            />
          </div>
          <p className="text-xs text-muted-foreground">Record votes against a selected resolution using a named board participant.</p>

          <Form {...resolutionForm}>
            <form className="grid grid-cols-1 md:grid-cols-4 gap-2" onSubmit={resolutionForm.handleSubmit((v) => addResolution.mutate(v))}>
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

          <Table>
            <TableHeader><TableRow><TableHead>Resolution</TableHead><TableHead>Meeting</TableHead><TableHead>Date</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
            <TableBody>
              {filteredResolutions.map((r) => {
                const meeting = meetings?.find((m) => m.id === r.meetingId);
                return (
                  <TableRow key={r.id} onClick={() => setSelectedResolutionId(r.id)} className="cursor-pointer">
                    <TableCell>{r.title}</TableCell>
                    <TableCell>{meeting?.title || "-"}</TableCell>
                    <TableCell>{meeting?.scheduledAt ? new Date(meeting.scheduledAt).toLocaleDateString() : "-"}</TableCell>
                    <TableCell><Badge variant={r.status === "approved" ? "default" : r.status === "rejected" ? "destructive" : "secondary"}>{r.status}</Badge></TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
              <Select value={voteForm.watch("voterPersonId")} onValueChange={(v) => voteForm.setValue("voterPersonId", v)}>
                <SelectTrigger><SelectValue placeholder="Board voter" /></SelectTrigger>
                <SelectContent>
                  {(persons ?? []).map((p) => <SelectItem key={p.id} value={p.id}>{p.firstName} {p.lastName}</SelectItem>)}
                </SelectContent>
              </Select>
            <Select value={voteForm.watch("voteChoice")} onValueChange={(v) => voteForm.setValue("voteChoice", v as "yes" | "no" | "abstain")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="yes">yes</SelectItem>
                <SelectItem value="no">no</SelectItem>
                <SelectItem value="abstain">abstain</SelectItem>
              </SelectContent>
            </Select>
            <Input type="number" step="0.1" value={voteForm.watch("voteWeight")} onChange={(e) => voteForm.setValue("voteWeight", Number(e.target.value))} />
            <Button disabled={!selectedResolutionId || addVote.isPending} onClick={voteForm.handleSubmit((v) => addVote.mutate(v))}>Record Vote</Button>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Badge variant="secondary">Selected resolution votes: {(votes ?? []).length}</Badge>
            <Badge variant="outline">Yes: {(votes ?? []).filter((v) => v.voteChoice === "yes").length}</Badge>
            <Badge variant="outline">No: {(votes ?? []).filter((v) => v.voteChoice === "no").length}</Badge>
            <Badge variant="outline">Abstain: {(votes ?? []).filter((v) => v.voteChoice === "abstain").length}</Badge>
          </div>
        </CardContent>
      </Card>

      <Dialog open={noteOpen} onOpenChange={setNoteOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Notes & Summary</DialogTitle></DialogHeader>
          <Form {...noteForm}>
            <form
              className="space-y-4"
              onSubmit={noteForm.handleSubmit((v) => {
                if (!selectedMeeting) return;
                updateMeeting.mutate({ id: selectedMeeting.id, payload: { notes: v.notes || null, summaryText: v.summaryText || null } });
                setNoteOpen(false);
              })}
            >
              <FormField control={noteForm.control} name="notes" render={({ field }) => (
                <FormItem><FormLabel>Meeting Notes</FormLabel><FormControl><Textarea rows={6} {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={noteForm.control} name="summaryText" render={({ field }) => (
                <FormItem><FormLabel>Summary Draft</FormLabel><FormControl><Textarea rows={5} {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <Button className="w-full" type="submit">Save</Button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
