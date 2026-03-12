import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import type { AnnualGovernanceTask, Association, CalendarEvent, GovernanceComplianceTemplate, GovernanceTemplateItem, Person } from "@shared/schema";
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

const templateSchema = z.object({
  associationId: z.string().optional(),
  scope: z.enum(["ct-baseline", "association"]),
  year: z.coerce.number().int().min(2024).max(2100),
  name: z.string().min(1),
});

const itemSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  dueMonth: z.coerce.number().int().min(1).max(12),
  dueDay: z.coerce.number().int().min(1).max(31),
  orderIndex: z.coerce.number().int().min(0),
});

const taskSchema = z.object({
  associationId: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional(),
  ownerPersonId: z.string().optional(),
  dueDate: z.string().optional(),
});

const calendarSchema = z.object({
  associationId: z.string().min(1),
  title: z.string().min(1),
  startsAt: z.string().min(1),
  endsAt: z.string().optional(),
});

export default function GovernanceCompliancePage() {
  const { toast } = useToast();
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const { activeAssociationId, activeAssociationName } = useActiveAssociation();
  const [associationFilter, setAssociationFilter] = useState(activeAssociationId);
  const [openTemplate, setOpenTemplate] = useState(false);
  const [openTask, setOpenTask] = useState(false);
  const [openCalendar, setOpenCalendar] = useState(false);

  const { data: associations } = useQuery<Association[]>({ queryKey: ["/api/associations"] });
  const { data: persons } = useQuery<Person[]>({ queryKey: ["/api/persons"] });
  const { data: templates } = useQuery<GovernanceComplianceTemplate[]>({ queryKey: ["/api/governance/templates"] });
  const { data: calendarEvents } = useQuery<CalendarEvent[]>({ queryKey: ["/api/governance/calendar/events"] });
  const { data: templateItems } = useQuery<GovernanceTemplateItem[]>({
    queryKey: ["/api/governance/templates", selectedTemplateId || "none", "items"],
    queryFn: async () => {
      if (!selectedTemplateId) return [];
      const res = await apiRequest("GET", `/api/governance/templates/${selectedTemplateId}/items`);
      return res.json();
    },
    enabled: Boolean(selectedTemplateId),
  });
  const { data: tasks } = useQuery<AnnualGovernanceTask[]>({ queryKey: ["/api/governance/tasks"] });

  const templateForm = useForm<z.infer<typeof templateSchema>>({
    resolver: zodResolver(templateSchema),
    defaultValues: { associationId: "", scope: "ct-baseline", year: new Date().getFullYear(), name: "CT Baseline Checklist" },
  });
  const itemForm = useForm<z.infer<typeof itemSchema>>({
    resolver: zodResolver(itemSchema),
    defaultValues: { title: "", description: "", dueMonth: 1, dueDay: 1, orderIndex: 0 },
  });
  const taskForm = useForm<z.infer<typeof taskSchema>>({
    resolver: zodResolver(taskSchema),
    defaultValues: { associationId: "", title: "", description: "", ownerPersonId: "", dueDate: "" },
  });
  const calendarForm = useForm<z.infer<typeof calendarSchema>>({
    resolver: zodResolver(calendarSchema),
    defaultValues: { associationId: "", title: "", startsAt: "", endsAt: "" },
  });

  useEffect(() => {
    setAssociationFilter(activeAssociationId);
    taskForm.setValue("associationId", activeAssociationId, { shouldValidate: true });
    calendarForm.setValue("associationId", activeAssociationId, { shouldValidate: true });
    if (templateForm.watch("scope") === "association") {
      templateForm.setValue("associationId", activeAssociationId, { shouldValidate: true });
    }
  }, [activeAssociationId, calendarForm, taskForm, templateForm]);

  const createTemplate = useMutation({
    mutationFn: async (v: z.infer<typeof templateSchema>) => {
      const res = await apiRequest("POST", "/api/governance/templates", {
        associationId: v.scope === "association" ? (v.associationId || null) : null,
        scope: v.scope,
        year: v.year,
        name: v.name,
      });
      return res.json();
    },
    onSuccess: (created: GovernanceComplianceTemplate) => {
      queryClient.invalidateQueries({ queryKey: ["/api/governance/templates"] });
      setOpenTemplate(false);
      setSelectedTemplateId(created.id);
      toast({ title: "Template created" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const createTemplateItem = useMutation({
    mutationFn: async (v: z.infer<typeof itemSchema>) => {
      if (!selectedTemplateId) throw new Error("Select a template first");
      const res = await apiRequest("POST", `/api/governance/templates/${selectedTemplateId}/items`, v);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/governance/templates", selectedTemplateId, "items"] });
      itemForm.reset();
      toast({ title: "Template item added" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const createTask = useMutation({
    mutationFn: async (v: z.infer<typeof taskSchema>) => {
      const res = await apiRequest("POST", "/api/governance/tasks", {
        associationId: v.associationId,
        title: v.title,
        description: v.description || null,
        ownerPersonId: v.ownerPersonId || null,
        dueDate: v.dueDate ? new Date(v.dueDate).toISOString() : null,
        status: "todo",
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/governance/tasks"] });
      setOpenTask(false);
      taskForm.reset();
      toast({ title: "Governance task created" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const generateTasks = useMutation({
    mutationFn: async () => {
      if (!associationFilter || !selectedTemplateId) throw new Error("Select association and template");
      const template = templates?.find((t) => t.id === selectedTemplateId);
      const year = template?.year ?? new Date().getFullYear();
      const res = await apiRequest("POST", "/api/governance/tasks/generate", {
        associationId: associationFilter,
        templateId: selectedTemplateId,
        year,
      });
      return res.json();
    },
    onSuccess: (result: { created: number }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/governance/tasks"] });
      toast({ title: `Generated ${result.created} tasks` });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const updateTask = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "todo" | "in-progress" | "done" }) => {
      const res = await apiRequest("PATCH", `/api/governance/tasks/${id}`, { status });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/governance/tasks"] });
    },
  });
  const createCalendarEvent = useMutation({
    mutationFn: async (v: z.infer<typeof calendarSchema>) => {
      const res = await apiRequest("POST", "/api/governance/calendar/events", {
        associationId: v.associationId,
        eventType: "governance",
        title: v.title,
        startsAt: new Date(v.startsAt).toISOString(),
        endsAt: v.endsAt ? new Date(v.endsAt).toISOString() : null,
        relatedType: "compliance-task",
        relatedId: null,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/governance/calendar/events"] });
      calendarForm.reset();
      setOpenCalendar(false);
      toast({ title: "Calendar event added" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const filteredTasks = useMemo(() => {
    const list = tasks ?? [];
    if (!associationFilter) return list;
    return list.filter((t) => t.associationId === associationFilter);
  }, [tasks, associationFilter]);

  const now = new Date();
  const upcoming = filteredTasks.filter((t) => t.status !== "done" && t.dueDate && new Date(t.dueDate) >= now).length;
  const overdue = filteredTasks.filter((t) => t.status !== "done" && t.dueDate && new Date(t.dueDate) < now).length;
  const complete = filteredTasks.filter((t) => t.status === "done").length;

  const byStatus = {
    todo: filteredTasks.filter((t) => t.status === "todo"),
    inProgress: filteredTasks.filter((t) => t.status === "in-progress"),
    done: filteredTasks.filter((t) => t.status === "done"),
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Governance & Compliance</h1>
          <p className="text-muted-foreground">Manage CT baseline templates and generate annual governance tasks.</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={openTemplate} onOpenChange={setOpenTemplate}>
            <DialogTrigger asChild><Button variant="outline">New Template</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Create Compliance Template</DialogTitle></DialogHeader>
              <Form {...templateForm}>
                <form className="space-y-4" onSubmit={templateForm.handleSubmit((v) => createTemplate.mutate(v))}>
                  <FormField control={templateForm.control} name="scope" render={({ field }) => (
                    <FormItem><FormLabel>Scope</FormLabel><Select value={field.value} onValueChange={field.onChange}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="ct-baseline">ct-baseline</SelectItem><SelectItem value="association">association</SelectItem></SelectContent></Select><FormMessage /></FormItem>
                  )} />
                  {templateForm.watch("scope") === "association" ? (
                    <FormField control={templateForm.control} name="associationId" render={({ field }) => (
                      <FormItem><FormLabel>Association</FormLabel><Select value={field.value || "none"} onValueChange={(v) => field.onChange(v === "none" ? "" : v)}><FormControl><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger></FormControl><SelectContent><SelectItem value="none">select</SelectItem>{associations?.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>
                    )} />
                  ) : null}
                  <FormField control={templateForm.control} name="year" render={({ field }) => (<FormItem><FormLabel>Year</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)} />
                  <FormField control={templateForm.control} name="name" render={({ field }) => (<FormItem><FormLabel>Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                  <Button className="w-full" type="submit" disabled={createTemplate.isPending}>Save</Button>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
          <Dialog open={openTask} onOpenChange={setOpenTask}>
            <DialogTrigger asChild><Button>New Governance Task</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Create Annual Governance Task</DialogTitle></DialogHeader>
              <Form {...taskForm}>
                <form className="space-y-4" onSubmit={taskForm.handleSubmit((v) => createTask.mutate(v))}>
                  <FormField control={taskForm.control} name="associationId" render={({ field }) => (
                    <FormItem><FormLabel>Association</FormLabel><Select value={field.value} onValueChange={field.onChange}><FormControl><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger></FormControl><SelectContent>{associations?.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>
                  )} />
                  <FormField control={taskForm.control} name="title" render={({ field }) => (<FormItem><FormLabel>Title</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                  <FormField control={taskForm.control} name="description" render={({ field }) => (<FormItem><FormLabel>Description</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem>)} />
                  <div className="grid grid-cols-2 gap-4">
                    <FormField control={taskForm.control} name="ownerPersonId" render={({ field }) => (
                      <FormItem><FormLabel>Owner</FormLabel><Select value={field.value || "none"} onValueChange={(v) => field.onChange(v === "none" ? "" : v)}><FormControl><SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger></FormControl><SelectContent><SelectItem value="none">none</SelectItem>{persons?.map((p) => <SelectItem key={p.id} value={p.id}>{p.firstName} {p.lastName}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>
                    )} />
                    <FormField control={taskForm.control} name="dueDate" render={({ field }) => (<FormItem><FormLabel>Due Date</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>)} />
                  </div>
                  <Button className="w-full" type="submit" disabled={createTask.isPending}>Save</Button>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
          <Dialog open={openCalendar} onOpenChange={setOpenCalendar}>
            <DialogTrigger asChild><Button variant="outline">New Calendar Event</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Create Calendar Event</DialogTitle></DialogHeader>
              <Form {...calendarForm}>
                <form className="space-y-4" onSubmit={calendarForm.handleSubmit((v) => createCalendarEvent.mutate(v))}>
                  <FormField control={calendarForm.control} name="associationId" render={({ field }) => (
                    <FormItem><FormLabel>Association</FormLabel><Select value={field.value} onValueChange={field.onChange}><FormControl><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger></FormControl><SelectContent>{associations?.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>
                  )} />
                  <FormField control={calendarForm.control} name="title" render={({ field }) => (<FormItem><FormLabel>Title</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                  <div className="grid grid-cols-2 gap-4">
                    <FormField control={calendarForm.control} name="startsAt" render={({ field }) => (<FormItem><FormLabel>Start</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={calendarForm.control} name="endsAt" render={({ field }) => (<FormItem><FormLabel>End (optional)</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>)} />
                  </div>
                  <Button className="w-full" type="submit" disabled={createCalendarEvent.isPending}>Save</Button>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Badge variant="secondary">Open: {filteredTasks.filter((t) => t.status !== "done").length}</Badge>
            <Badge variant="secondary">Upcoming: {upcoming}</Badge>
            <Badge variant="destructive">Overdue: {overdue}</Badge>
            <Badge variant="default">Completed: {complete}</Badge>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium">Timeline / Calendar View</h3>
            <Badge variant="secondary">Events: {(calendarEvents ?? []).length}</Badge>
          </div>
          <div className="space-y-2">
            {(calendarEvents ?? [])
              .filter((e) => !associationFilter || e.associationId === associationFilter)
              .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())
              .map((event) => (
                <div key={event.id} className="rounded border p-2 text-sm flex items-center justify-between">
                  <span>{event.title}</span>
                  <span className="text-muted-foreground">{new Date(event.startsAt).toLocaleDateString()}</span>
                </div>
              ))}
            {!calendarEvents?.length ? <div className="text-sm text-muted-foreground">No calendar events yet.</div> : null}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm flex items-center">
              Association Context: <span className="font-medium ml-1">{activeAssociationName || "None selected"}</span>
            </div>
            <Select value={selectedTemplateId || "none"} onValueChange={(v) => setSelectedTemplateId(v === "none" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="Template" /></SelectTrigger>
              <SelectContent><SelectItem value="none">select template</SelectItem>{templates?.map((t) => <SelectItem key={t.id} value={t.id}>{t.name} ({t.year})</SelectItem>)}</SelectContent>
            </Select>
            <Button onClick={() => generateTasks.mutate()} disabled={generateTasks.isPending || !associationFilter || !selectedTemplateId}>Generate Year Tasks</Button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <h3 className="text-sm font-medium mb-2">Template Items</h3>
              <Form {...itemForm}>
                <form className="grid grid-cols-1 md:grid-cols-5 gap-2 mb-3" onSubmit={itemForm.handleSubmit((v) => createTemplateItem.mutate(v))}>
                  <Input placeholder="Title" value={itemForm.watch("title")} onChange={(e) => itemForm.setValue("title", e.target.value)} />
                  <Input placeholder="Month" type="number" value={itemForm.watch("dueMonth")} onChange={(e) => itemForm.setValue("dueMonth", Number(e.target.value))} />
                  <Input placeholder="Day" type="number" value={itemForm.watch("dueDay")} onChange={(e) => itemForm.setValue("dueDay", Number(e.target.value))} />
                  <Input placeholder="Order" type="number" value={itemForm.watch("orderIndex")} onChange={(e) => itemForm.setValue("orderIndex", Number(e.target.value))} />
                  <Button type="submit" disabled={createTemplateItem.isPending || !selectedTemplateId}>Add</Button>
                </form>
              </Form>
              <Table>
                <TableHeader><TableRow><TableHead>Title</TableHead><TableHead>Due</TableHead></TableRow></TableHeader>
                <TableBody>{(templateItems ?? []).map((i) => <TableRow key={i.id}><TableCell>{i.title}</TableCell><TableCell>{i.dueMonth}/{i.dueDay}</TableCell></TableRow>)}</TableBody>
              </Table>
            </div>

            <div>
              <h3 className="text-sm font-medium mb-2">Compliance Kanban</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {[{ key: "todo", label: "To Do", items: byStatus.todo }, { key: "in-progress", label: "In Progress", items: byStatus.inProgress }, { key: "done", label: "Done", items: byStatus.done }].map((lane) => (
                  <div key={lane.key} className="rounded border p-3 space-y-2">
                    <div className="text-xs font-medium uppercase text-muted-foreground">{lane.label} ({lane.items.length})</div>
                    {lane.items.map((t) => (
                      <button key={t.id} className="w-full text-left rounded border p-2 text-xs hover:bg-muted" onClick={() => updateTask.mutate({ id: t.id, status: lane.key === "todo" ? "in-progress" : lane.key === "in-progress" ? "done" : "done" })}>
                        <div className="font-medium text-sm">{t.title}</div>
                        <div className="text-muted-foreground">{t.dueDate ? new Date(t.dueDate).toLocaleDateString() : "No due date"}</div>
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-medium mb-2">Compliance Task Table</h3>
            <Table>
              <TableHeader><TableRow><TableHead>Task</TableHead><TableHead>Due</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
              <TableBody>
                {filteredTasks.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell>{t.title}</TableCell>
                    <TableCell>{t.dueDate ? new Date(t.dueDate).toLocaleDateString() : "-"}</TableCell>
                    <TableCell>
                      <Select value={t.status} onValueChange={(status) => updateTask.mutate({ id: t.id, status: status as "todo" | "in-progress" | "done" })}>
                        <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                        <SelectContent><SelectItem value="todo">todo</SelectItem><SelectItem value="in-progress">in-progress</SelectItem><SelectItem value="done">done</SelectItem></SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
