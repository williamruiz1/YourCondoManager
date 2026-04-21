import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { ftphFeatureTreeDefinition, type FeatureStatus, type FtphFeatureTreeResponse, type FtphFeatureSet, type FtphModule } from "@shared/ftph-feature-tree";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useActiveAssociation } from "@/hooks/use-active-association";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Toggle } from "@/components/ui/toggle";
import { RefreshCw, ChevronDown, ChevronRight, Plus, Calendar, Link2, GitBranch, Bookmark, BookmarkCheck, Layers3 } from "lucide-react";
import { WorkspacePageHeader } from "@/components/workspace-page-header";
import { platformSubPages } from "@/lib/sub-page-nav";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";

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

function getStatusTone(status: FeatureStatus) {
  if (status === "active") {
    return {
      badge: "border-emerald-200 bg-emerald-50 text-emerald-700",
      panel: "border-emerald-200 bg-emerald-50/40",
      rail: "bg-emerald-500",
    };
  }

  if (status === "partial") {
    return {
      badge: "border-amber-200 bg-amber-50 text-amber-700",
      panel: "border-amber-200 bg-amber-50/40",
      rail: "bg-amber-500",
    };
  }

  return {
    badge: "border-slate-200 bg-slate-100 text-slate-600",
    panel: "border-slate-200 bg-slate-50",
    rail: "bg-slate-400",
  };
}

function getDefinitionStatus(status?: FeatureStatus): FeatureStatus {
  return status ?? "active";
}

function toStoryPhrase(title: string) {
  return title.replace(/\b[A-Z]{2,}\b/g, (value) => value).replace(/\s+/g, " ").trim().toLowerCase();
}

function moduleUserStory(title: string) {
  return `As a platform operator, I want ${toStoryPhrase(title)} capabilities so this operating domain is covered in the roadmap and product model.`;
}

function featureSetUserStory(title: string) {
  return `As a property administrator, I want ${toStoryPhrase(title)} so this area of the platform is usable and traceable in day-to-day operations.`;
}

function functionalUnitUserStory(title: string, type: string) {
  const phrase = toStoryPhrase(title);

  if (type === "Logic") {
    return `As a property administrator, I want the system to handle ${phrase} so operational workflows run consistently.`;
  }

  if (type === "Data") {
    return `As a property administrator, I want to manage ${phrase} so the right records are stored and available when needed.`;
  }

  if (type === "Integration") {
    return `As a property administrator, I want ${phrase} integrated so work can move between this platform and connected systems without manual handoffs.`;
  }

  if (type === "Security") {
    return `As a platform administrator, I want ${phrase} enforced so access and risk are controlled appropriately.`;
  }

  return `As an end user, I want ${phrase} so I can complete this workflow directly in the platform.`;
}

function getFeatureSetCounts(featureSet: FtphFeatureSet) {
  const total = featureSet.functionalUnits.length;
  const active = featureSet.functionalUnits.filter((unit) => getDefinitionStatus(unit.status) === "active").length;
  return { active, total };
}

function getModuleCounts(module: FtphModule) {
  const units = module.featureSets.flatMap((featureSet) => featureSet.functionalUnits);
  const total = units.length;
  const active = units.filter((unit) => getDefinitionStatus(unit.status) === "active").length;
  return { active, total };
}

function getFunctionalUnitCounts(modules: FtphModule[]) {
  const units = modules.flatMap((module) => module.featureSets.flatMap((featureSet) => featureSet.functionalUnits));
  const active = units.filter((unit) => getDefinitionStatus(unit.status) === "active").length;
  const partial = units.filter((unit) => getDefinitionStatus(unit.status) === "partial").length;
  const inactive = units.filter((unit) => getDefinitionStatus(unit.status) === "inactive").length;
  return { total: units.length, active, partial, inactive };
}

const FEATURE_TREE_STORAGE_KEY = "admin-roadmap:feature-tree-state";

type FeatureTreePreferenceState = {
  expandedModuleIds: string[];
  expandedFeatureSetIds: string[];
  backlogIds: string[];
  backlogOnly: boolean;
  visibleStatuses: FeatureStatus[];
};

const ALL_FEATURE_STATUSES: FeatureStatus[] = ["active", "partial", "inactive"];

export default function RoadmapPage() {
  useDocumentTitle("Admin Roadmap");
  const { activeAssociationId, activeAssociationName } = useActiveAssociation();
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
  const [expandedModuleIds, setExpandedModuleIds] = useState<string[]>(() => ftphFeatureTreeDefinition.map((module) => module.id));
  const [expandedFeatureSetIds, setExpandedFeatureSetIds] = useState<string[]>(() =>
    ftphFeatureTreeDefinition.flatMap((module) => module.featureSets.map((featureSet) => `${module.id}:${featureSet.id}`)),
  );
  const [backlogIds, setBacklogIds] = useState<string[]>([]);
  const [backlogOnly, setBacklogOnly] = useState(false);
  const [visibleStatuses, setVisibleStatuses] = useState<FeatureStatus[]>(ALL_FEATURE_STATUSES);

  const { data, isLoading, refetch, isFetching, isError, error } = useQuery<RoadmapPayload>({
    queryKey: ["/api/admin/roadmap"],
  });
  const featureTreeQuery = useQuery<FtphFeatureTreeResponse>({
    queryKey: ["/api/admin/roadmap/feature-tree"],
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

  const analyticsQuery = useQuery<{
    analyzerMetrics: { totalRuns: number; successRate: number; avgDurationMs: number; avgItemCount: number };
    roadmapMetrics: {
      totalProjects: number;
      totalWorkstreams: number;
      totalTasks: number;
      archivedProjects: number;
      archivedCompletedProjects: number;
      taskStatusDistribution: { todo: number; inProgress: number; done: number };
      completionRate: number;
      taskThroughput: number;
    };
  }>({
    queryKey: [activeAssociationId ? `/api/admin/analytics?days=30&associationId=${activeAssociationId}` : "/api/admin/analytics?days=30"],
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
  const featureTreeModules = featureTreeQuery.data?.modules ?? [];
  const featureTreeCounts = useMemo(
    () =>
      featureTreeModules.reduce(
        (acc, module) => {
          const status = getDefinitionStatus(module.status);
          acc[status] += 1;
          return acc;
        },
        { active: 0, partial: 0, inactive: 0 },
      ),
    [featureTreeModules],
  );
  const featureTreeBacklogCount = backlogIds.length;
  const allFeatureSetKeys = useMemo(
    () => featureTreeModules.flatMap((module) => module.featureSets.map((featureSet) => `${module.id}:${featureSet.id}`)),
    [featureTreeModules],
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(FEATURE_TREE_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<FeatureTreePreferenceState>;
      if (Array.isArray(parsed.expandedModuleIds)) setExpandedModuleIds(parsed.expandedModuleIds);
      if (Array.isArray(parsed.expandedFeatureSetIds)) setExpandedFeatureSetIds(parsed.expandedFeatureSetIds);
      if (Array.isArray(parsed.backlogIds)) setBacklogIds(parsed.backlogIds);
      if (typeof parsed.backlogOnly === "boolean") {
        const hasBacklogMarks = Array.isArray(parsed.backlogIds) && parsed.backlogIds.length > 0;
        setBacklogOnly(parsed.backlogOnly && hasBacklogMarks);
      }
      if (Array.isArray(parsed.visibleStatuses) && parsed.visibleStatuses.length > 0) {
        const nextVisibleStatuses = parsed.visibleStatuses.filter(
          (value): value is FeatureStatus => value === "active" || value === "partial" || value === "inactive",
        );
        setVisibleStatuses(nextVisibleStatuses.length > 0 ? nextVisibleStatuses : ALL_FEATURE_STATUSES);
      }
    } catch {
      // Ignore malformed local state and fall back to defaults.
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const payload: FeatureTreePreferenceState = {
      expandedModuleIds,
      expandedFeatureSetIds,
      backlogIds,
      backlogOnly,
      visibleStatuses,
    };
    window.localStorage.setItem(FEATURE_TREE_STORAGE_KEY, JSON.stringify(payload));
  }, [expandedModuleIds, expandedFeatureSetIds, backlogIds, backlogOnly, visibleStatuses]);

  useEffect(() => {
    if (backlogOnly && backlogIds.length === 0) {
      setBacklogOnly(false);
    }
  }, [backlogIds, backlogOnly]);

  const toggleModuleExpanded = (moduleId: string) => {
    setExpandedModuleIds((current) => (current.includes(moduleId) ? current.filter((id) => id !== moduleId) : [...current, moduleId]));
  };

  const toggleFeatureSetExpanded = (featureSetKey: string) => {
    setExpandedFeatureSetIds((current) =>
      current.includes(featureSetKey) ? current.filter((id) => id !== featureSetKey) : [...current, featureSetKey],
    );
  };

  const toggleBacklog = (key: string) => {
    setBacklogIds((current) => (current.includes(key) ? current.filter((id) => id !== key) : [...current, key]));
  };

  const toggleVisibleStatus = (status: FeatureStatus) => {
    setVisibleStatuses((current) => {
      if (current.includes(status)) {
        if (current.length === 1) return current;
        return current.filter((value) => value !== status);
      }
      return [...current, status];
    });
  };

  const resetFeatureTreeFilters = () => {
    setBacklogOnly(false);
    setVisibleStatuses(ALL_FEATURE_STATUSES);
  };

  const isBacklogMarked = (key: string) => backlogIds.includes(key);

  const moduleMatchesBacklog = (moduleId: string, featureSetIds: string[], unitIds: string[]) =>
    isBacklogMarked(`module:${moduleId}`) ||
    featureSetIds.some((id) => isBacklogMarked(id)) ||
    unitIds.some((id) => isBacklogMarked(id));

  const timelineScheduled = (data?.timeline ?? []).filter((item) => item.targetStartDate || item.targetEndDate || item.dependencyTaskIds.length > 0);
  const timelineUnscheduled = tasks.filter((task) => !task.targetStartDate && !task.targetEndDate && task.dependencyTaskIds.length === 0);
  const visibleFeatureTreeModules = featureTreeModules.filter((module) => {
    const moduleStatus = getDefinitionStatus(module.status);
    const featureSetKeys = module.featureSets.map((featureSet) => `feature-set:${module.id}:${featureSet.id}`);
    const unitKeys = module.featureSets.flatMap((featureSet) =>
      featureSet.functionalUnits.map((unit) => `unit:${module.id}:${featureSet.id}:${unit.id}`),
    );
    return visibleStatuses.includes(moduleStatus) && (!backlogOnly || moduleMatchesBacklog(module.id, featureSetKeys, unitKeys));
  });
  const featureTreeUnitCounts = useMemo(() => getFunctionalUnitCounts(featureTreeModules), [featureTreeModules]);
  const visibleFeatureTreeUnitCounts = useMemo(() => getFunctionalUnitCounts(visibleFeatureTreeModules), [visibleFeatureTreeModules]);

  return (
    <div className="p-6 space-y-6">
      <WorkspacePageHeader
        title="Unified Roadmap"
        summary="Cross-project planning, execution, dependencies, and timeline audit."
        eyebrow="Platform"
        breadcrumbs={[{ label: "Platform", href: "/app/platform/controls" }, { label: "Unified Roadmap" }]}
        subPages={platformSubPages}
        actions={
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
        }
      />

      <Tabs defaultValue="roadmap" className="space-y-6">
        <TabsList>
          <TabsTrigger value="roadmap">Roadmap</TabsTrigger>
          <TabsTrigger value="feature-tree">Feature Tree</TabsTrigger>
        </TabsList>

        <TabsContent value="roadmap" className="space-y-6">
          <Card>
            <CardContent className="py-4 text-sm text-muted-foreground flex items-center justify-between gap-2 flex-wrap">
              <div>Last refreshed: <span className="font-medium text-foreground">{format(new Date(data?.refreshedAt || lastRefreshedAt), "yyyy-MM-dd HH:mm:ss")}</span></div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary">Projects: {analyticsQuery.data?.roadmapMetrics.totalProjects ?? 0}</Badge>
                <Badge variant="secondary">Workstreams: {analyticsQuery.data?.roadmapMetrics.totalWorkstreams ?? 0}</Badge>
                <Badge variant="secondary">Tasks: {analyticsQuery.data?.roadmapMetrics.totalTasks ?? 0}</Badge>
                <Badge variant="secondary">Completion: {analyticsQuery.data?.roadmapMetrics.completionRate ?? 0}%</Badge>
                <Badge variant="outline">
                  Archived: {(analyticsQuery.data?.roadmapMetrics.archivedProjects ?? 0)}
                  {" / "}
                  Completed: {(analyticsQuery.data?.roadmapMetrics.archivedCompletedProjects ?? 0)}
                </Badge>
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
        </TabsContent>

        <TabsContent value="feature-tree" className="space-y-6">
          <Card>
            <CardContent className="py-5">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <div className="text-lg font-semibold">Feature Tree Summary</div>
                  <div className="text-sm text-muted-foreground">
                    Functional-unit coverage across the documentation tree, with current active coverage surfaced first.
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="secondary">Functional Units: {featureTreeUnitCounts.total}</Badge>
                  <Badge className={cn("border", getStatusTone("active").badge)}>Active: {featureTreeUnitCounts.active}</Badge>
                  <Badge className={cn("border", getStatusTone("partial").badge)}>Partial: {featureTreeUnitCounts.partial}</Badge>
                  <Badge className={cn("border", getStatusTone("inactive").badge)}>Inactive: {featureTreeUnitCounts.inactive}</Badge>
                  <Badge variant="outline">Visible Now: {visibleFeatureTreeUnitCounts.total}</Badge>
                  <Badge variant="outline">Backlog Marks: {featureTreeBacklogCount}</Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex items-center justify-between gap-4 py-5 flex-wrap">
              <div>
                <div className="text-lg font-semibold">FTPH Documentation Feature Tree</div>
                <div className="text-sm text-muted-foreground">
                  Module, feature-set, and functional-unit hierarchy from the FTPH documentation, colorized against what is currently active in the published platform.
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {(["active", "partial", "inactive"] as FeatureStatus[]).map((status) => {
                  const pressed = visibleStatuses.includes(status);
                  const label = status === "active" ? "Active Modules" : status === "partial" ? "Partial Modules" : "Inactive Modules";
                  return (
                    <button
                      key={status}
                      type="button"
                      onClick={() => toggleVisibleStatus(status)}
                      className="rounded-full"
                      aria-pressed={pressed}
                    >
                      <Badge
                        className={cn(
                          "border cursor-pointer transition-opacity",
                          getStatusTone(status).badge,
                          pressed ? "opacity-100" : "opacity-45",
                        )}
                      >
                        {label}: {featureTreeCounts[status]}
                      </Badge>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex items-center justify-between gap-3 py-4 flex-wrap">
              <div className="text-sm text-muted-foreground">
                Collapse branches to focus the tree, and mark modules, feature sets, or functional units for backlog follow-up.
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setExpandedModuleIds(featureTreeModules.map((module) => module.id));
                    setExpandedFeatureSetIds(allFeatureSetKeys);
                  }}
                >
                  Expand All
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setExpandedModuleIds([]);
                    setExpandedFeatureSetIds([]);
                  }}
                >
                  Collapse All
                </Button>
                <Toggle
                  pressed={backlogOnly}
                  onPressedChange={setBacklogOnly}
                  variant="outline"
                  size="sm"
                  aria-label="Show backlog only"
                >
                  <Layers3 className="h-4 w-4" />
                  Backlog Only
                </Toggle>
              </div>
            </CardContent>
          </Card>

          {featureTreeQuery.isLoading ? (
            <Card>
              <CardContent className="p-6 text-sm text-muted-foreground">Loading feature tree...</CardContent>
            </Card>
          ) : null}

          {featureTreeQuery.isError ? (
            <Card>
              <CardContent className="p-6 space-y-3">
                <div className="font-medium">Unable to load feature tree</div>
                <div className="text-sm text-muted-foreground">
                  {(featureTreeQuery.error as Error)?.message || "Unknown error"}
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => featureTreeQuery.refetch()}>
                    Retry
                  </Button>
                  <Button size="sm" variant="outline" onClick={resetFeatureTreeFilters}>
                    Reset Filters
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : null}

          {!featureTreeQuery.isLoading && !featureTreeQuery.isError && featureTreeModules.length === 0 ? (
            <Card>
              <CardContent className="p-6 space-y-3">
                <div className="font-medium">No feature-tree modules were returned</div>
                <div className="text-sm text-muted-foreground">
                  The documentation parser returned an empty module list. This is a data issue, not a UI collapse issue.
                </div>
                <Button size="sm" variant="outline" onClick={() => featureTreeQuery.refetch()}>
                  Reload Feature Tree
                </Button>
              </CardContent>
            </Card>
          ) : null}

          {!featureTreeQuery.isLoading && !featureTreeQuery.isError && featureTreeModules.length > 0 && visibleFeatureTreeModules.length === 0 ? (
            <Card>
              <CardContent className="p-6 space-y-3">
                <div className="font-medium">No modules match the current filters</div>
                <div className="text-sm text-muted-foreground">
                  Clear status filters or turn off backlog-only mode to show the full tree again.
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={resetFeatureTreeFilters}>
                    Reset Filters
                  </Button>
                  {backlogIds.length === 0 ? (
                    <div className="text-xs text-muted-foreground self-center">
                      Backlog-only mode is automatically disabled when there are no backlog marks.
                    </div>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          ) : null}

          <div className="grid gap-4">
            {visibleFeatureTreeModules.map((module) => {
              const moduleStatus = getDefinitionStatus(module.status);
              const moduleCounts = getModuleCounts(module);
              const moduleBacklogKey = `module:${module.id}`;
              const featureSetKeys = module.featureSets.map((featureSet) => `feature-set:${module.id}:${featureSet.id}`);
              const unitKeys = module.featureSets.flatMap((featureSet) =>
                featureSet.functionalUnits.map((unit) => `unit:${module.id}:${featureSet.id}:${unit.id}`),
              );
              const moduleTone = getStatusTone(moduleStatus);
              const moduleExpanded = expandedModuleIds.includes(module.id);
              const moduleBacklog = isBacklogMarked(moduleBacklogKey);

              return (
                <Collapsible key={module.id} open={moduleExpanded} onOpenChange={() => toggleModuleExpanded(module.id)}>
                  <Card className={cn("overflow-hidden border", moduleTone.panel, moduleBacklog ? "ring-2 ring-blue-300" : "")}>
                    <CardHeader className="pb-4">
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div className="flex items-start gap-3">
                          <CollapsibleTrigger asChild>
                            <Button variant="outline" size="sm" className="mt-0.5 px-2">
                              {moduleExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                            </Button>
                          </CollapsibleTrigger>
                          <div>
                            <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Module {module.id}</div>
                            <div className="mt-1 flex items-center gap-2 flex-wrap">
                              <CardTitle className="text-xl">{module.title}</CardTitle>
                              <Badge variant="outline">{moduleCounts.active}/{moduleCounts.total} active</Badge>
                            </div>
                            <p className="mt-2 max-w-3xl text-sm text-foreground/80">{module.purpose || moduleUserStory(module.title)}</p>
                            {module.notes ? <p className="mt-2 max-w-3xl text-sm text-muted-foreground">{module.notes}</p> : null}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge className={cn("border capitalize", moduleTone.badge)}>{moduleStatus}</Badge>
                          <Toggle
                            pressed={moduleBacklog}
                            onPressedChange={() => toggleBacklog(moduleBacklogKey)}
                            variant="outline"
                            size="sm"
                            aria-label={`Mark module ${module.title} for backlog`}
                          >
                            {moduleBacklog ? <BookmarkCheck className="h-4 w-4" /> : <Bookmark className="h-4 w-4" />}
                            Backlog
                          </Toggle>
                        </div>
                      </div>
                    </CardHeader>

                    <CollapsibleContent>
                      <CardContent className="space-y-4">
                        {module.featureSets.map((featureSet) => {
                          const featureBacklogKey = `feature-set:${module.id}:${featureSet.id}`;
                          const unitKeysForFeature = featureSet.functionalUnits.map((unit) => `unit:${module.id}:${featureSet.id}:${unit.id}`);
                          const featureIncluded =
                            !backlogOnly || isBacklogMarked(featureBacklogKey) || unitKeysForFeature.some((key) => isBacklogMarked(key));
                          if (!featureIncluded) return null;

                          const featureStatus = getDefinitionStatus(featureSet.status);
                          const featureCounts = getFeatureSetCounts(featureSet);
                          const featureTone = getStatusTone(featureStatus);
                          const featureSetKey = `${module.id}:${featureSet.id}`;
                          const featureExpanded = expandedFeatureSetIds.includes(featureSetKey);
                          const featureBacklog = isBacklogMarked(featureBacklogKey);

                          return (
                            <Collapsible
                              key={featureSet.id}
                              open={featureExpanded}
                              onOpenChange={() => toggleFeatureSetExpanded(featureSetKey)}
                            >
                              <div className={cn("rounded-lg border p-4", featureTone.panel, featureBacklog ? "ring-2 ring-blue-300" : "")}>
                                <div className="flex items-start justify-between gap-3 flex-wrap">
                                  <div className="flex items-start gap-3">
                                    <CollapsibleTrigger asChild>
                                      <Button variant="outline" size="sm" className="mt-0.5 px-2">
                                        {featureExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                      </Button>
                                    </CollapsibleTrigger>
                                    <div>
                                      <div className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Feature Set {featureSet.id}</div>
                                      <div className="mt-1 flex items-center gap-2 flex-wrap">
                                        <div className="text-base font-semibold">{featureSet.title}</div>
                                        <Badge variant="outline">{featureCounts.active}/{featureCounts.total} active</Badge>
                                      </div>
                                      <p className="mt-2 text-sm text-foreground/80">
                                        {featureSet.userStory || featureSet.intentSummary || featureSet.description || featureSetUserStory(featureSet.title)}
                                      </p>
                                      {featureSet.notes ? <p className="mt-2 text-sm text-muted-foreground">{featureSet.notes}</p> : null}
                                      {featureSet.scopeBoundary ? <p className="mt-2 text-sm text-muted-foreground">Scope: {featureSet.scopeBoundary}</p> : null}
                                      {featureSet.dependencies?.length ? <p className="mt-2 text-sm text-muted-foreground">Dependencies: {featureSet.dependencies.join(" · ")}</p> : null}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <Badge className={cn("border capitalize", featureTone.badge)}>{featureStatus}</Badge>
                                    <Toggle
                                      pressed={featureBacklog}
                                      onPressedChange={() => toggleBacklog(featureBacklogKey)}
                                      variant="outline"
                                      size="sm"
                                      aria-label={`Mark feature set ${featureSet.title} for backlog`}
                                    >
                                      {featureBacklog ? <BookmarkCheck className="h-4 w-4" /> : <Bookmark className="h-4 w-4" />}
                                      Backlog
                                    </Toggle>
                                  </div>
                                </div>

                                <CollapsibleContent className="mt-4 space-y-3">
                                  {featureSet.functionalUnits.map((unit) => {
                                    const unitBacklogKey = `unit:${module.id}:${featureSet.id}:${unit.id}`;
                                    const unitIncluded = !backlogOnly || isBacklogMarked(unitBacklogKey);
                                    if (!unitIncluded) return null;

                                    const unitStatus = getDefinitionStatus(unit.status);
                                    const unitTone = getStatusTone(unitStatus);
                                    const unitBacklog = isBacklogMarked(unitBacklogKey);
                                    return (
                                      <div key={unit.id} className="grid grid-cols-[10px_1fr] gap-3">
                                        <div className={cn("mt-1 rounded-full", unitTone.rail)} />
                                        <div className={cn("rounded-md border bg-background px-3 py-3", unitBacklog ? "ring-2 ring-blue-300" : "")}>
                                          <div className="flex items-center justify-between gap-3 flex-wrap">
                                            <div>
                                              <div className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Functional Unit {unit.id}</div>
                                              <div className="mt-1 text-sm font-medium">{unit.title}</div>
                                              <p className="mt-2 text-sm text-foreground/80">
                                                {unit.userStory || unit.summary || unit.documentationNotes?.[0] || functionalUnitUserStory(unit.title, unit.type)}
                                              </p>
                                            </div>
                                            <div className="flex items-center gap-2 flex-wrap">
                                              <Badge variant="outline">{unit.type}</Badge>
                                              <Badge className={cn("border capitalize", unitTone.badge)}>{unitStatus}</Badge>
                                              <Toggle
                                                pressed={unitBacklog}
                                                onPressedChange={() => toggleBacklog(unitBacklogKey)}
                                                variant="outline"
                                                size="sm"
                                                aria-label={`Mark functional unit ${unit.title} for backlog`}
                                              >
                                                {unitBacklog ? <BookmarkCheck className="h-4 w-4" /> : <Bookmark className="h-4 w-4" />}
                                                Backlog
                                              </Toggle>
                                            </div>
                                          </div>
                                          {unit.notes ? <p className="mt-2 text-sm text-muted-foreground">{unit.notes}</p> : null}
                                          {unit.acceptanceCriteria?.length ? (
                                            <div className="mt-2 text-sm text-muted-foreground">
                                              Acceptance: {unit.acceptanceCriteria.join(" · ")}
                                            </div>
                                          ) : null}
                                          {!unit.acceptanceCriteria?.length && unit.documentationNotes && unit.documentationNotes.length > 1 ? (
                                            <div className="mt-2 text-sm text-muted-foreground">
                                              Notes: {unit.documentationNotes.slice(1).join(" · ")}
                                            </div>
                                          ) : null}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </CollapsibleContent>
                              </div>
                            </Collapsible>
                          );
                        })}
                      </CardContent>
                    </CollapsibleContent>
                  </Card>
                </Collapsible>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>

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
