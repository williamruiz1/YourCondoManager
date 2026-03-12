import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RefreshCw, ChevronDown, ChevronRight, Plus, Calendar, Link2, GitBranch } from "lucide-react";

type TaskStatus = "todo" | "in-progress" | "done";
type ProjectStatus = "active" | "complete" | "archived";

type Progress = {
  totalTasks: number;
  todoTasks: number;
  inProgressTasks: number;
  doneTasks: number;
  completionRate: number;
  state: "not-started" | "in-progress" | "complete";
};

type RoadmapProject = {
  id: string;
  title: string;
  description: string | null;
  status: ProjectStatus;
  isCollapsed: number;
  progress: Progress & { projectId: string; workstreamCount: number };
};

type RoadmapWorkstream = {
  id: string;
  projectId: string;
  title: string;
  description: string | null;
  orderIndex: number;
  isCollapsed: number;
  progress: Progress & { workstreamId: string };
};

type RoadmapTask = {
  id: string;
  projectId: string;
  workstreamId: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  effort: "small" | "medium" | "large" | null;
  priority: "low" | "medium" | "high" | "critical" | null;
  dependencyTaskIds: string[];
  targetStartDate: string | null;
  targetEndDate: string | null;
  completedDate: string | null;
  createdAt: string;
  updatedAt: string;
};

type TimelineItem = {
  taskId: string;
  projectId: string;
  workstreamId: string;
  title: string;
  targetStartDate: string | null;
  targetEndDate: string | null;
  dependencyTaskIds: string[];
  startsBeforeDependenciesComplete: boolean;
};

type RoadmapPayload = {
  projects: RoadmapProject[];
  workstreams: RoadmapWorkstream[];
  tasks: RoadmapTask[];
  timeline: TimelineItem[];
  refreshedAt: string;
};

type TaskFormState = {
  id?: string;
  title: string;
  description: string;
  projectId: string;
  workstreamId: string;
  status: TaskStatus;
  effort: "small" | "medium" | "large" | "";
  priority: "low" | "medium" | "high" | "critical" | "";
  dependencyTaskIds: string;
  targetStartDate: string;
  targetEndDate: string;
};

type ProjectFormState = {
  title: string;
  description: string;
  status: ProjectStatus;
};

type WorkstreamFormState = {
  projectId: string;
  title: string;
  description: string;
  orderIndex: number;
};

const EMPTY_FORM: TaskFormState = {
  title: "",
  description: "",
  projectId: "",
  workstreamId: "",
  status: "todo",
  effort: "",
  priority: "",
  dependencyTaskIds: "",
  targetStartDate: "",
  targetEndDate: "",
};

const EMPTY_PROJECT_FORM: ProjectFormState = {
  title: "",
  description: "",
  status: "active",
};

const EMPTY_WORKSTREAM_FORM: WorkstreamFormState = {
  projectId: "",
  title: "",
  description: "",
  orderIndex: 0,
};

const KANBAN_LANES: { key: TaskStatus; label: string }[] = [
  { key: "todo", label: "To Do" },
  { key: "in-progress", label: "In Progress" },
  { key: "done", label: "Done" },
];

function fmtDate(value: string | null) {
  if (!value) return "-";
  return format(new Date(value), "yyyy-MM-dd");
}

function pct(value: number) {
  return `${value}%`;
}

export default function RoadmapPage() {
  const { toast } = useToast();
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [projectModalOpen, setProjectModalOpen] = useState(false);
  const [workstreamModalOpen, setWorkstreamModalOpen] = useState(false);
  const [taskForm, setTaskForm] = useState<TaskFormState>(EMPTY_FORM);
  const [projectForm, setProjectForm] = useState<ProjectFormState>(EMPTY_PROJECT_FORM);
  const [workstreamForm, setWorkstreamForm] = useState<WorkstreamFormState>(EMPTY_WORKSTREAM_FORM);
  const [showTimeline, setShowTimeline] = useState(true);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<string>(new Date().toISOString());
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);

  const { data, isLoading, refetch, isFetching, isError, error } = useQuery<RoadmapPayload>({
    queryKey: ["/api/admin/roadmap"],
  });

  const projects = data?.projects ?? [];
  const workstreams = data?.workstreams ?? [];
  const tasks = data?.tasks ?? [];

  const projectById = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);
  const workstreamById = useMemo(() => new Map(workstreams.map((w) => [w.id, w])), [workstreams]);
  const taskById = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks]);

  const groupedByWorkstreamAndStatus = useMemo(() => {
    const grouped = new Map<string, Record<TaskStatus, RoadmapTask[]>>();

    for (const ws of workstreams) {
      grouped.set(ws.id, { todo: [], "in-progress": [], done: [] });
    }

    for (const task of tasks) {
      const ws = grouped.get(task.workstreamId);
      if (!ws) continue;
      ws[task.status].push(task);
    }

    return grouped;
  }, [tasks, workstreams]);

  const refreshRoadmap = async () => {
    await refetch();
    const next = new Date().toISOString();
    setLastRefreshedAt(next);
    toast({ title: "Roadmap refreshed", description: `Updated at ${fmtDate(next)} ${format(new Date(next), "HH:mm:ss")}` });
  };

  const invalidateRoadmap = async () => {
    await queryClient.invalidateQueries({ queryKey: ["/api/admin/roadmap"] });
    const next = new Date().toISOString();
    setLastRefreshedAt(next);
  };

  const toggleProjectMutation = useMutation({
    mutationFn: ({ id, isCollapsed }: { id: string; isCollapsed: number }) => apiRequest("PATCH", `/api/admin/projects/${id}`, { isCollapsed }),
    onSuccess: invalidateRoadmap,
    onError: (error: Error) => toast({ title: "Error", description: error.message, variant: "destructive" }),
  });

  const toggleProjectArchiveMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: ProjectStatus }) => apiRequest("PATCH", `/api/admin/projects/${id}`, { status }),
    onSuccess: invalidateRoadmap,
    onError: (error: Error) => toast({ title: "Error", description: error.message, variant: "destructive" }),
  });

  const toggleWorkstreamMutation = useMutation({
    mutationFn: ({ id, isCollapsed }: { id: string; isCollapsed: number }) => apiRequest("PATCH", `/api/admin/workstreams/${id}`, { isCollapsed }),
    onSuccess: invalidateRoadmap,
    onError: (error: Error) => toast({ title: "Error", description: error.message, variant: "destructive" }),
  });

  const createProjectMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => apiRequest("POST", "/api/admin/projects", payload),
    onSuccess: async () => {
      await invalidateRoadmap();
      setProjectModalOpen(false);
      setProjectForm(EMPTY_PROJECT_FORM);
      toast({ title: "Project created" });
    },
    onError: (error: Error) => toast({ title: "Error", description: error.message, variant: "destructive" }),
  });

  const createWorkstreamMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => apiRequest("POST", "/api/admin/workstreams", payload),
    onSuccess: async () => {
      await invalidateRoadmap();
      setWorkstreamModalOpen(false);
      setWorkstreamForm(EMPTY_WORKSTREAM_FORM);
      toast({ title: "Workstream created" });
    },
    onError: (error: Error) => toast({ title: "Error", description: error.message, variant: "destructive" }),
  });

  const createTaskMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => apiRequest("POST", "/api/admin/tasks", payload),
    onSuccess: async () => {
      await invalidateRoadmap();
      setTaskModalOpen(false);
      setTaskForm(EMPTY_FORM);
      toast({ title: "Task created" });
    },
    onError: (error: Error) => toast({ title: "Error", description: error.message, variant: "destructive" }),
  });

  const updateTaskMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Record<string, unknown> }) => apiRequest("PATCH", `/api/admin/tasks/${id}`, payload),
    onSuccess: async () => {
      await invalidateRoadmap();
      setTaskModalOpen(false);
      setTaskForm(EMPTY_FORM);
      toast({ title: "Task updated" });
    },
    onError: (error: Error) => toast({ title: "Error", description: error.message, variant: "destructive" }),
  });

  const patchTaskMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Record<string, unknown> }) => apiRequest("PATCH", `/api/admin/tasks/${id}`, payload),
    onSuccess: invalidateRoadmap,
    onError: (error: Error) => toast({ title: "Error", description: error.message, variant: "destructive" }),
  });

  const analyticsQuery = useQuery<{ analyzerMetrics: { totalRuns: number; successRate: number; avgDurationMs: number; avgItemCount: number }; roadmapMetrics: { totalProjects: number; totalWorkstreams: number; totalTasks: number; taskStatusDistribution: { todo: number; inProgress: number; done: number }; completionRate: number; taskThroughput: number } }>({
    queryKey: ["/api/admin/analytics?days=30"],
  });

  const dependencyWarning = (task: RoadmapTask, nextStatus: TaskStatus) => {
    if (!(nextStatus === "in-progress" || nextStatus === "done")) return;

    const unresolved = task.dependencyTaskIds.filter((id) => taskById.get(id)?.status !== "done");
    if (unresolved.length > 0) {
      toast({
        title: "Dependency warning",
        description: `${task.title} has ${unresolved.length} unfinished dependencies.`,
      });
    }
  };

  const submitTaskForm = () => {
    if (!taskForm.title.trim() || !taskForm.projectId || !taskForm.workstreamId) {
      toast({ title: "Missing required fields", variant: "destructive" });
      return;
    }

    const payload = {
      title: taskForm.title.trim(),
      description: taskForm.description.trim() || null,
      projectId: taskForm.projectId,
      workstreamId: taskForm.workstreamId,
      status: taskForm.status,
      effort: taskForm.effort || null,
      priority: taskForm.priority || null,
      dependencyTaskIds: taskForm.dependencyTaskIds
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean),
      targetStartDate: taskForm.targetStartDate ? new Date(taskForm.targetStartDate).toISOString() : null,
      targetEndDate: taskForm.targetEndDate ? new Date(taskForm.targetEndDate).toISOString() : null,
    };

    if (taskForm.id) {
      updateTaskMutation.mutate({ id: taskForm.id, payload });
      return;
    }

    createTaskMutation.mutate(payload);
  };

  const submitProjectForm = () => {
    if (!projectForm.title.trim()) {
      toast({ title: "Project title is required", variant: "destructive" });
      return;
    }

    createProjectMutation.mutate({
      title: projectForm.title.trim(),
      description: projectForm.description.trim() || null,
      status: projectForm.status,
      isCollapsed: projectForm.status === "active" ? 0 : 1,
    });
  };

  const submitWorkstreamForm = () => {
    if (!workstreamForm.projectId || !workstreamForm.title.trim()) {
      toast({ title: "Project and workstream title are required", variant: "destructive" });
      return;
    }

    createWorkstreamMutation.mutate({
      projectId: workstreamForm.projectId,
      title: workstreamForm.title.trim(),
      description: workstreamForm.description.trim() || null,
      orderIndex: Number.isNaN(workstreamForm.orderIndex) ? 0 : workstreamForm.orderIndex,
      isCollapsed: 0,
    });
  };

  const openTaskCreate = (projectId?: string, workstreamId?: string) => {
    const fallbackProject = projectId || projects.find((p) => p.status === "active")?.id || projects[0]?.id || "";
    const fallbackWorkstream =
      workstreamId ||
      workstreams.find((ws) => ws.projectId === fallbackProject)?.id ||
      workstreams[0]?.id ||
      "";

    setTaskForm({ ...EMPTY_FORM, projectId: fallbackProject, workstreamId: fallbackWorkstream });
    setTaskModalOpen(true);
  };

  const openTaskEdit = (task: RoadmapTask) => {
    setTaskForm({
      id: task.id,
      title: task.title,
      description: task.description || "",
      projectId: task.projectId,
      workstreamId: task.workstreamId,
      status: task.status,
      effort: task.effort ?? "",
      priority: task.priority ?? "",
      dependencyTaskIds: task.dependencyTaskIds.join(", "),
      targetStartDate: task.targetStartDate ? format(new Date(task.targetStartDate), "yyyy-MM-dd") : "",
      targetEndDate: task.targetEndDate ? format(new Date(task.targetEndDate), "yyyy-MM-dd") : "",
    });
    setTaskModalOpen(true);
  };

  const handleDropTask = (workstreamId: string, status: TaskStatus) => {
    if (!draggedTaskId) return;

    const task = taskById.get(draggedTaskId);
    if (!task) return;

    dependencyWarning(task, status);

    patchTaskMutation.mutate({
      id: draggedTaskId,
      payload: {
        workstreamId,
        projectId: workstreamById.get(workstreamId)?.projectId,
        status,
      },
    });

    setDraggedTaskId(null);
  };

  const activeProjects = projects.filter((p) => p.status === "active");
  const completeProjects = projects.filter((p) => p.status === "complete");
  const archivedProjects = projects.filter((p) => p.status === "archived");

  const timelineScheduled = (data?.timeline ?? []).filter((item) => item.targetStartDate || item.targetEndDate || item.dependencyTaskIds.length > 0);
  const timelineUnscheduled = tasks.filter((task) => !task.targetStartDate && !task.targetEndDate && task.dependencyTaskIds.length === 0);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-page-title">Unified Roadmap</h1>
          <p className="text-muted-foreground">Cross-project planning, execution, dependencies, and timeline audit.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setProjectModalOpen(true)} data-testid="button-create-project">
            <Plus className="h-4 w-4 mr-2" />
            New Project
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              setWorkstreamForm((prev) => ({
                ...prev,
                projectId: prev.projectId || projects[0]?.id || "",
              }));
              setWorkstreamModalOpen(true);
            }}
            data-testid="button-create-workstream"
          >
            <Plus className="h-4 w-4 mr-2" />
            New Workstream
          </Button>
          <Button variant="outline" onClick={() => setShowTimeline((v) => !v)} data-testid="button-toggle-timeline">
            <GitBranch className="h-4 w-4 mr-2" />
            {showTimeline ? "Hide Timeline" : "Show Timeline"}
          </Button>
          <Button variant="outline" onClick={refreshRoadmap} disabled={isFetching} data-testid="button-refresh-roadmap">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={() => openTaskCreate()} data-testid="button-create-task" disabled={workstreams.length === 0}>
            <Plus className="h-4 w-4 mr-2" />
            New Task
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="py-4 text-sm text-muted-foreground flex items-center justify-between gap-2 flex-wrap">
          <div>Last refreshed: <span className="font-medium text-foreground">{format(new Date(data?.refreshedAt || lastRefreshedAt), "yyyy-MM-dd HH:mm:ss")}</span></div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">Projects: {analyticsQuery.data?.roadmapMetrics.totalProjects ?? 0}</Badge>
            <Badge variant="secondary">Workstreams: {analyticsQuery.data?.roadmapMetrics.totalWorkstreams ?? 0}</Badge>
            <Badge variant="secondary">Tasks: {analyticsQuery.data?.roadmapMetrics.totalTasks ?? 0}</Badge>
            <Badge variant="secondary">Completion: {analyticsQuery.data?.roadmapMetrics.completionRate ?? 0}%</Badge>
          </div>
        </CardContent>
      </Card>

      {isLoading ? <Card><CardContent className="p-6">Loading roadmap...</CardContent></Card> : null}
      {isError ? (
        <Card>
          <CardContent className="p-6 space-y-3">
            <div className="font-medium">Unable to load roadmap</div>
            <div className="text-sm text-muted-foreground">{(error as Error)?.message || "Unknown error"}</div>
            {(error as Error)?.message?.includes("403") ? (
              <div className="text-xs text-muted-foreground">
                If this is an auth error, set credentials from the header using <span className="font-medium">Set Admin Auth</span>.
              </div>
            ) : null}
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => refetch()}>Retry</Button>
              <Button size="sm" onClick={refreshRoadmap}>Refresh</Button>
            </div>
            <div className="text-xs text-muted-foreground">
              If this continues, check server logs for `/api/admin/roadmap` and confirm the backend is running the latest code.
            </div>
          </CardContent>
        </Card>
      ) : null}
      {!isLoading && !isError && projects.length === 0 ? (
        <Card>
          <CardContent className="p-6 flex items-center justify-between gap-3 flex-wrap">
            <div className="text-sm text-muted-foreground">No roadmap projects yet.</div>
            <Button onClick={() => setProjectModalOpen(true)}>Create First Project</Button>
          </CardContent>
        </Card>
      ) : null}

      {!isError && [
        { label: "Active Projects", projects: activeProjects },
        { label: "Completed Projects", projects: completeProjects },
        { label: "Archived Projects", projects: archivedProjects },
      ].map((section) => (
        <div key={section.label} className="space-y-4">
          <h2 className="text-lg font-semibold">{section.label}</h2>
          {section.projects.map((project) => {
            const projectWorkstreams = workstreams.filter((ws) => ws.projectId === project.id);
            const canMarkComplete = project.progress.totalTasks > 0 && project.progress.doneTasks === project.progress.totalTasks;
            return (
              <Card key={project.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <button
                      className="flex items-center gap-2 text-left"
                      onClick={() => toggleProjectMutation.mutate({ id: project.id, isCollapsed: project.isCollapsed ? 0 : 1 })}
                      data-testid={`button-toggle-project-${project.id}`}
                    >
                      {project.isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      <span className="font-semibold">{project.title}</span>
                    </button>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant={project.status === "active" ? "default" : "secondary"}>{project.status}</Badge>
                      <Badge variant="outline">{project.progress.doneTasks}/{project.progress.totalTasks} done</Badge>
                      <Badge variant="outline">{pct(project.progress.completionRate)}</Badge>
                      <Badge variant="outline">Workstreams: {project.progress.workstreamCount}</Badge>
                      {project.status !== "complete" ? (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={!canMarkComplete}
                          onClick={() => toggleProjectArchiveMutation.mutate({ id: project.id, status: "complete" })}
                        >
                          Mark Complete
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => toggleProjectArchiveMutation.mutate({ id: project.id, status: "active" })}
                        >
                          Reopen
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          toggleProjectArchiveMutation.mutate({
                            id: project.id,
                            status: project.status === "archived" ? "active" : "archived",
                          })
                        }
                      >
                        {project.status === "archived" ? "Activate" : "Archive"}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setWorkstreamForm((prev) => ({
                            ...prev,
                            projectId: project.id,
                            orderIndex: projectWorkstreams.length,
                          }));
                          setWorkstreamModalOpen(true);
                        }}
                      >
                        Add Workstream
                      </Button>
                      <Button size="sm" onClick={() => openTaskCreate(project.id)}>Add Task</Button>
                    </div>
                  </div>
                </CardHeader>

                {!project.isCollapsed && (
                  <CardContent className="space-y-4">
                    {projectWorkstreams.map((workstream) => {
                      const lanes = groupedByWorkstreamAndStatus.get(workstream.id) ?? { todo: [], "in-progress": [], done: [] };

                      return (
                        <Card key={workstream.id}>
                          <CardHeader className="pb-3">
                            <div className="flex items-center justify-between gap-3 flex-wrap">
                              <button
                                className="flex items-center gap-2 text-left"
                                onClick={() => toggleWorkstreamMutation.mutate({ id: workstream.id, isCollapsed: workstream.isCollapsed ? 0 : 1 })}
                                data-testid={`button-toggle-workstream-${workstream.id}`}
                              >
                                {workstream.isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                <span className="font-medium">{workstream.title}</span>
                              </button>
                              <div className="flex items-center gap-2 flex-wrap">
                                <Badge variant="outline">{workstream.progress.doneTasks}/{workstream.progress.totalTasks}</Badge>
                                <Badge variant="outline">{pct(workstream.progress.completionRate)}</Badge>
                                <Button size="sm" variant="outline" onClick={() => openTaskCreate(project.id, workstream.id)}>New Task</Button>
                              </div>
                            </div>
                          </CardHeader>

                          {!workstream.isCollapsed && (
                            <CardContent>
                              <div className="grid gap-3 md:grid-cols-3">
                                {KANBAN_LANES.map((lane) => (
                                  <div
                                    key={`${workstream.id}-${lane.key}`}
                                    className="rounded-md border p-3 bg-muted/20 min-h-28"
                                    onDragOver={(event) => event.preventDefault()}
                                    onDrop={() => handleDropTask(workstream.id, lane.key)}
                                  >
                                    <div className="text-sm font-medium mb-2 flex items-center justify-between">
                                      <span>{lane.label}</span>
                                      <Badge variant="secondary">{lanes[lane.key].length}</Badge>
                                    </div>
                                    <div className="space-y-2">
                                      {lanes[lane.key].map((task) => {
                                        const unresolvedDeps = task.dependencyTaskIds.filter((id) => taskById.get(id)?.status !== "done").length;
                                        return (
                                          <button
                                            key={task.id}
                                            className="w-full rounded border bg-background p-2 text-left hover:bg-accent"
                                            draggable
                                            onDragStart={() => setDraggedTaskId(task.id)}
                                            onClick={() => openTaskEdit(task)}
                                            data-testid={`card-task-${task.id}`}
                                          >
                                            <div className="font-medium text-sm">{task.title}</div>
                                            <div className="mt-1 flex items-center gap-1 flex-wrap">
                                              {task.priority ? <Badge variant="outline">{task.priority}</Badge> : null}
                                              {task.effort ? <Badge variant="outline">{task.effort}</Badge> : null}
                                              {task.dependencyTaskIds.length > 0 ? <Badge variant="secondary"><Link2 className="h-3 w-3 mr-1" />{task.dependencyTaskIds.length}</Badge> : null}
                                              {unresolvedDeps > 0 ? <Badge variant="destructive">{unresolvedDeps} blocked</Badge> : null}
                                              {task.completedDate ? <Badge variant="secondary">Done {fmtDate(task.completedDate)}</Badge> : null}
                                            </div>
                                          </button>
                                        );
                                      })}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </CardContent>
                          )}
                        </Card>
                      );
                    })}
                  </CardContent>
                )}
              </Card>
            );
          })}
          {section.projects.length === 0 ? (
            <Card><CardContent className="p-4 text-sm text-muted-foreground">No projects in this section.</CardContent></Card>
          ) : null}
        </div>
      ))}

      {!isError && showTimeline && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Hybrid Timeline (Dates + Dependencies)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {timelineScheduled.length === 0 ? (
              <div className="text-sm text-muted-foreground">No scheduled or dependency-linked tasks yet.</div>
            ) : (
              <div className="space-y-2">
                {timelineScheduled.map((item) => {
                  const task = taskById.get(item.taskId);
                  const project = projectById.get(item.projectId);
                  const workstream = workstreamById.get(item.workstreamId);

                  return (
                    <div key={item.taskId} className="rounded border p-3">
                      <div className="font-medium">{item.title}</div>
                      <div className="text-xs text-muted-foreground">{project?.title} / {workstream?.title}</div>
                      <div className="mt-2 flex items-center gap-2 flex-wrap text-xs">
                        <Badge variant="outline"><Calendar className="h-3 w-3 mr-1" />{fmtDate(item.targetStartDate)} to {fmtDate(item.targetEndDate)}</Badge>
                        <Badge variant="outline"><Link2 className="h-3 w-3 mr-1" />Deps: {item.dependencyTaskIds.length}</Badge>
                        {item.startsBeforeDependenciesComplete ? <Badge variant="destructive">Starts before dependency completion</Badge> : null}
                        {task?.status ? <Badge variant="secondary">{task.status}</Badge> : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {timelineUnscheduled.length > 0 && (
              <div>
                <h3 className="text-sm font-medium mb-2">Unscheduled Tasks</h3>
                <div className="text-xs text-muted-foreground">Visible in roadmap but not strongly positioned in timeline.</div>
                <div className="mt-2 flex gap-2 flex-wrap">
                  {timelineUnscheduled.map((task) => (
                    <Badge key={task.id} variant="secondary">{task.title}</Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Dialog open={projectModalOpen} onOpenChange={setProjectModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Project</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1">
              <Label>Title</Label>
              <Input value={projectForm.title} onChange={(event) => setProjectForm((prev) => ({ ...prev, title: event.target.value }))} />
            </div>
            <div className="grid gap-1">
              <Label>Description</Label>
              <Textarea value={projectForm.description} onChange={(event) => setProjectForm((prev) => ({ ...prev, description: event.target.value }))} />
            </div>
            <div className="grid gap-1">
              <Label>Status</Label>
              <select
                className="border rounded-md h-9 px-2 bg-background"
                value={projectForm.status}
                onChange={(event) => setProjectForm((prev) => ({ ...prev, status: event.target.value as ProjectStatus }))}
              >
                <option value="active">active</option>
                <option value="archived">archived</option>
              </select>
            </div>
            <Button onClick={submitProjectForm} disabled={createProjectMutation.isPending}>
              Create Project
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={workstreamModalOpen} onOpenChange={setWorkstreamModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Workstream</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1">
              <Label>Project</Label>
              <select
                className="border rounded-md h-9 px-2 bg-background"
                value={workstreamForm.projectId}
                onChange={(event) => setWorkstreamForm((prev) => ({ ...prev, projectId: event.target.value }))}
              >
                <option value="">Select project</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>{project.title}</option>
                ))}
              </select>
            </div>
            <div className="grid gap-1">
              <Label>Title</Label>
              <Input value={workstreamForm.title} onChange={(event) => setWorkstreamForm((prev) => ({ ...prev, title: event.target.value }))} />
            </div>
            <div className="grid gap-1">
              <Label>Description</Label>
              <Textarea value={workstreamForm.description} onChange={(event) => setWorkstreamForm((prev) => ({ ...prev, description: event.target.value }))} />
            </div>
            <div className="grid gap-1">
              <Label>Order Index</Label>
              <Input
                type="number"
                value={workstreamForm.orderIndex}
                onChange={(event) => setWorkstreamForm((prev) => ({ ...prev, orderIndex: Number(event.target.value) }))}
              />
            </div>
            <Button onClick={submitWorkstreamForm} disabled={createWorkstreamMutation.isPending}>
              Create Workstream
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={taskModalOpen} onOpenChange={setTaskModalOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{taskForm.id ? "Edit Task" : "Create Task"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1">
              <Label>Title</Label>
              <Input value={taskForm.title} onChange={(event) => setTaskForm((prev) => ({ ...prev, title: event.target.value }))} />
            </div>

            <div className="grid gap-1">
              <Label>Description</Label>
              <Textarea value={taskForm.description} onChange={(event) => setTaskForm((prev) => ({ ...prev, description: event.target.value }))} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1">
                <Label>Project</Label>
                <select
                  className="border rounded-md h-9 px-2 bg-background"
                  value={taskForm.projectId}
                  onChange={(event) => {
                    const projectId = event.target.value;
                    const firstWorkstream = workstreams.find((ws) => ws.projectId === projectId)?.id || "";
                    setTaskForm((prev) => ({ ...prev, projectId, workstreamId: firstWorkstream }));
                  }}
                >
                  <option value="">Select project</option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>{project.title}</option>
                  ))}
                </select>
              </div>
              <div className="grid gap-1">
                <Label>Workstream</Label>
                <select
                  className="border rounded-md h-9 px-2 bg-background"
                  value={taskForm.workstreamId}
                  onChange={(event) => setTaskForm((prev) => ({ ...prev, workstreamId: event.target.value }))}
                >
                  <option value="">Select workstream</option>
                  {workstreams.filter((ws) => ws.projectId === taskForm.projectId).map((ws) => (
                    <option key={ws.id} value={ws.id}>{ws.title}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1">
                <Label>Status</Label>
                <select className="border rounded-md h-9 px-2 bg-background" value={taskForm.status} onChange={(event) => setTaskForm((prev) => ({ ...prev, status: event.target.value as TaskStatus }))}>
                  <option value="todo">todo</option>
                  <option value="in-progress">in-progress</option>
                  <option value="done">done</option>
                </select>
              </div>
              <div className="grid gap-1">
                <Label>Priority</Label>
                <select className="border rounded-md h-9 px-2 bg-background" value={taskForm.priority} onChange={(event) => setTaskForm((prev) => ({ ...prev, priority: event.target.value as TaskFormState["priority"] }))}>
                  <option value="">None</option>
                  <option value="low">low</option>
                  <option value="medium">medium</option>
                  <option value="high">high</option>
                  <option value="critical">critical</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1">
                <Label>Effort</Label>
                <select className="border rounded-md h-9 px-2 bg-background" value={taskForm.effort} onChange={(event) => setTaskForm((prev) => ({ ...prev, effort: event.target.value as TaskFormState["effort"] }))}>
                  <option value="">None</option>
                  <option value="small">small</option>
                  <option value="medium">medium</option>
                  <option value="large">large</option>
                </select>
              </div>
              <div className="grid gap-1">
                <Label>Dependency Task IDs</Label>
                <Input placeholder="id1, id2" value={taskForm.dependencyTaskIds} onChange={(event) => setTaskForm((prev) => ({ ...prev, dependencyTaskIds: event.target.value }))} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1">
                <Label>Target Start Date</Label>
                <Input type="date" value={taskForm.targetStartDate} onChange={(event) => setTaskForm((prev) => ({ ...prev, targetStartDate: event.target.value }))} />
              </div>
              <div className="grid gap-1">
                <Label>Target End Date</Label>
                <Input type="date" value={taskForm.targetEndDate} onChange={(event) => setTaskForm((prev) => ({ ...prev, targetEndDate: event.target.value }))} />
              </div>
            </div>

            <Button onClick={submitTaskForm} disabled={createTaskMutation.isPending || updateTaskMutation.isPending}>
              {taskForm.id ? "Update Task" : "Create Task"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
