# Admin Roadmap System Architecture

## Overview
The admin roadmap is a platform-wide planning and execution tracking system. It is **not** tenant-scoped — it tracks development work across the entire platform, visible only to admin users.

The system has four entity tiers, an executive-update sync layer, and an analysis/telemetry layer.

## Entity Hierarchy

```
Platform (global admin scope)
├── RoadmapProject (0-N)
│   ├── RoadmapWorkstream (1-N per project)
│   │   └── RoadmapTask (0-N per workstream)
│   │       ├── RoadmapTaskAttachment (0-N per task)
│   │       └── dependencyTaskIds → other tasks (same project only)
│   │
│   └── Progress (computed, not stored)
│       └── ProjectProgress { totalTasks, completionRate, workstreamCount, state }
│
├── ExecutiveUpdate (synced from task/project completion)
│   └── ExecutiveEvidence (0-N per update)
│
├── AnalysisVersion (roadmap snapshots)
└── AnalysisRun (friction logging, closeout records)
```

## Data Model

### Enums

| Enum | Values | Used By |
|------|--------|---------|
| `roadmap_project_status` | active, complete, archived | Projects |
| `roadmap_task_status` | todo, in-progress, done | Tasks |
| `roadmap_effort` | small, medium, large | Tasks |
| `roadmap_priority` | low, medium, high, critical | Tasks |
| `executive_update_status` | draft, published | Executive updates |
| `executive_source_type` | manual, roadmap-task, roadmap-project | Executive updates |
| `executive_evidence_type` | release-note, metric, screenshot, link, note | Executive evidence |

### Table: `admin_roadmap_projects`

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | Primary key, auto-generated |
| title | text | Required |
| description | text | Optional |
| status | enum | Default: "active" |
| isCollapsed | integer | UI collapse state (0/1) |
| createdAt | timestamp | Auto |
| updatedAt | timestamp | Auto |

**Constraints:**
- Cannot mark "complete" unless all tasks are "done"
- Global scope — no associationId

### Table: `admin_roadmap_workstreams`

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | Primary key, auto-generated |
| projectId | UUID | FK → roadmapProjects.id, required |
| title | text | Required |
| description | text | Optional |
| orderIndex | integer | Sort order within project, default: 0 |
| isCollapsed | integer | UI collapse state (0/1) |
| createdAt | timestamp | Auto |
| updatedAt | timestamp | Auto |

**Constraints:**
- Cannot move to a different project if tasks exist
- Workstreams represent organizational divisions (phases, feature areas, cross-cutting concerns)

### Table: `admin_roadmap_tasks`

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | Primary key, auto-generated |
| projectId | UUID | FK → roadmapProjects.id, required |
| workstreamId | UUID | FK → roadmapWorkstreams.id, required |
| title | text | Required |
| description | text | Optional |
| status | enum | Default: "todo" |
| effort | enum | Optional |
| priority | enum | Optional |
| dependencyTaskIds | text[] | Array of task UUIDs, default: empty |
| targetStartDate | timestamp | Optional planning date |
| targetEndDate | timestamp | Optional planning date |
| completedDate | timestamp | Auto-set when status="done", cleared on reopen |
| createdAt | timestamp | Auto |
| updatedAt | timestamp | Auto |

**Constraints:**
- task.projectId must match workstream.projectId
- Dependencies must reference tasks in the same project
- No circular dependencies (DFS-based cycle detection at create/update)
- completedDate is system-managed — auto-set on "done", cleared on reopen

### Table: `admin_roadmap_task_attachments`

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | Primary key, auto-generated |
| taskId | UUID | FK → roadmapTasks.id, required |
| fileUrl | text | URL to uploaded file |
| fileName | text | Original filename |
| mimeType | text | File MIME type |
| sizeBytes | integer | Optional |
| uploadedBy | text | Optional |
| createdAt | timestamp | Auto |

### Table: `admin_executive_updates`

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | Primary key, auto-generated |
| title | text | Required |
| headline | text | Required |
| summary | text | Required |
| problemStatement | text | Optional |
| solutionSummary | text | Optional |
| featuresDelivered | text[] | Array of feature descriptions |
| businessValue | text | Optional |
| status | enum | Default: "draft" |
| sourceType | enum | Default: "manual" |
| sourceKey | text | Unique — dedup key for auto-synced updates |
| projectId | UUID | FK → roadmapProjects.id, optional |
| workstreamId | UUID | FK → roadmapWorkstreams.id, optional |
| taskId | UUID | FK → roadmapTasks.id, optional |
| deliveredAt | timestamp | Optional |
| displayOrder | integer | Default: 0 |
| createdBy | text | Optional |
| createdAt | timestamp | Auto |
| updatedAt | timestamp | Auto |

**Sync behavior:**
- When a task transitions to "done" → auto-creates/updates an executive update (sourceType: "roadmap-task")
- When a project transitions to "complete" → auto-creates/updates an aggregate executive update (sourceType: "roadmap-project")

### Table: `admin_executive_evidence`

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | Primary key, auto-generated |
| executiveUpdateId | UUID | FK → executiveUpdates.id, required |
| evidenceType | enum | Default: "note" |
| label | text | Required |
| value | text | Required |
| metadataJson | jsonb | Optional |
| createdAt | timestamp | Auto |

### Table: `admin_analysis_versions`

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | Primary key, auto-generated |
| resourceId | text | What was analyzed |
| module | text | Which analysis module |
| version | integer | Incrementing version number |
| payloadJson | jsonb | Snapshot data |
| itemCount | integer | Default: 0 |
| trigger | text | What caused this snapshot |
| createdAt | timestamp | Auto |

### Table: `admin_analysis_runs`

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | Primary key, auto-generated |
| resourceId | text | What was analyzed |
| module | text | Which analysis module |
| action | text | What action was taken (friction-log, closeout, metrics, sync) |
| success | integer | 0/1, default: 1 |
| durationMs | integer | Default: 0 |
| itemCount | integer | Default: 0 |
| errorMessage | text | Optional |
| metadataJson | jsonb | Optional |
| createdAt | timestamp | Auto |

## Progress Computation

Progress is **computed at query time**, not stored. The storage layer calculates:

```
WorkState = "not-started" | "in-progress" | "complete"

ProgressSummary {
  totalTasks: number
  todoTasks: number
  inProgressTasks: number
  doneTasks: number
  completionRate: number   // percentage (0-100)
  state: WorkState         // derived from task distribution
}

WorkstreamProgress extends ProgressSummary {
  workstreamId: string
}

ProjectProgress extends ProgressSummary {
  projectId: string
  workstreamCount: number
}
```

**State determination:**
- `not-started` → zero tasks
- `complete` → all tasks are "done"
- `in-progress` → mixed statuses

## Timeline

Timeline is also computed at query time:

```
TimelineItem {
  taskId: string
  projectId: string
  workstreamId: string
  title: string
  targetStartDate: Date | null
  targetEndDate: Date | null
  dependencyTaskIds: string[]
  startsBeforeDependenciesComplete: boolean  // validation warning
}
```

Sorted by targetStartDate, then targetEndDate. The `startsBeforeDependenciesComplete` flag warns when a task's start date precedes its dependencies' completion.

## API Response Shape

The main roadmap endpoint returns a complete snapshot:

```
RoadmapResponse {
  projects: (RoadmapProject & { progress: ProjectProgress })[]
  workstreams: (RoadmapWorkstream & { progress: WorkstreamProgress })[]
  tasks: RoadmapTask[]
  timeline: TimelineItem[]
  executiveUpdates: ExecutiveUpdate[]
  analysisVersions: AnalysisVersion[]
  refreshedAt: string  // ISO timestamp
}
```

## API Routes

All routes require admin authentication and one of: platform-admin, board-admin, manager roles.

### Roadmap State
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/admin/roadmap` | Complete roadmap snapshot with progress |
| GET | `/api/admin/roadmap/feature-tree` | FTPH feature tree mapped against roadmap |

### Projects
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/admin/projects` | Create project |
| GET | `/api/admin/projects/:projectId` | Get project |
| PATCH | `/api/admin/projects/:projectId` | Update project |
| DELETE | `/api/admin/projects/:projectId` | Delete project (cascades) |

### Workstreams
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/admin/workstreams` | Create workstream |
| GET | `/api/admin/workstreams/:workstreamId` | Get workstream |
| PATCH | `/api/admin/workstreams/:workstreamId` | Update workstream |
| DELETE | `/api/admin/workstreams/:workstreamId` | Delete workstream (cascades) |

### Tasks
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/admin/tasks` | Create task (validates dependencies) |
| GET | `/api/admin/tasks/:taskId` | Get task |
| PATCH | `/api/admin/tasks/:taskId` | Update task (validates dependencies, syncs executive) |
| DELETE | `/api/admin/tasks/:taskId` | Delete task (cleans dependency refs) |

### Task Attachments
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/admin/tasks/:taskId/attachments` | List attachments |
| POST | `/api/admin/tasks/:taskId/attachments` | Upload attachment (multipart) |
| DELETE | `/api/admin/tasks/:taskId/attachments/:attachmentId` | Delete attachment |

### Contextual Feedback Integration
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/admin/contextual-feedback` | Creates a task in the "Admin Contextual Feedback" project's "Inbox" workstream |

## Cascading Delete Behavior

| Delete Target | Cascades To |
|---------------|-------------|
| Project | All workstreams → all tasks → all attachments; removes dependency refs |
| Workstream | All tasks → all attachments; removes dependency refs |
| Task | All attachments; removes this task ID from other tasks' dependencyTaskIds |
| Attachment | Nothing |

## Dependency Validation

On task create or update, the system validates:
1. All referenced dependency task IDs exist
2. All dependencies are within the same project
3. No circular dependency would be created (DFS-based traversal)

## Executive Update Sync Pattern

When a task transitions to `status: "done"`:
- System creates or updates an ExecutiveUpdate with `sourceType: "roadmap-task"`
- Uses a deterministic `sourceKey` for idempotent upsert

When a project transitions to `status: "complete"`:
- System creates or updates an ExecutiveUpdate with `sourceType: "roadmap-project"`
- Includes aggregate completion data and list of completed tasks

This allows the roadmap to feed executive dashboards without manual data entry.

## Analysis Layer

Two tables support the backbone improvement loop:

- **AnalysisVersions** — point-in-time snapshots of roadmap state, recommendations, or metrics
- **AnalysisRuns** — records of friction logging, closeout, metrics generation, and sync operations

These are used by the backbone automation commands:
```bash
npm run backbone:friction    # Log repeated setup friction
npm run backbone:closeout    # Generate closeout observations
npm run backbone:metrics     # Generate metrics snapshot
npm run backbone:sync-friction --threshold=2  # Convert friction → planning tasks
```

## UI Structure

The roadmap page (`client/src/pages/roadmap.tsx`) provides:
- **Tab views:** Roadmap view and Feature Tree view
- **Project cards:** Title, status badge, progress bar, workstream count, collapse toggle
- **Workstream sections:** Title, task list, progress, collapse toggle, ordering
- **Task items:** Title, status/effort/priority badges, dates, dependency links, edit/delete
- **Create dialogs:** Forms for projects, workstreams, and tasks with full validation
- **Dependency picker:** Multi-select from other tasks in the same project
- **Timeline view:** Tasks ordered by dates with dependency edge visualization

## Contextual Feedback Widget

The admin contextual feedback widget (`client/src/components/admin-contextual-feedback-widget.tsx`) integrates with the roadmap by:
- Auto-creating a "Admin Contextual Feedback" project if it doesn't exist
- Auto-creating an "Inbox" workstream within that project
- Converting feedback submissions into roadmap tasks with optional screenshot attachments
- Allowing feedback items to be resolved when the corresponding task is marked done

## Key Architectural Decisions

1. **Global scope, not tenant-scoped** — roadmap tracks platform development, not per-association data
2. **Progress is computed, not stored** — always reflects real task status, no drift
3. **Dependencies are same-project only** — simplifies validation and prevents cross-project coupling
4. **Executive sync is automatic** — task/project completion auto-generates executive updates
5. **Collapse state is persisted** — UI preferences survive across sessions
6. **Workstreams have explicit order** — `orderIndex` allows drag-and-drop reordering
7. **Analysis is append-only** — versions and runs create new records, never mutate old ones
8. **Contextual feedback flows into roadmap** — admin observations become visible planning work automatically

## Seeding and Programmatic Creation

Projects, workstreams, and tasks can be created programmatically via scripts. See `script/add-ftph-backlog-roadmap-project.ts` for an example that:
- Creates a project with a title and description
- Creates workstreams for each feature area
- Creates tasks within each workstream with effort, priority, and descriptions
- This pattern is used to seed roadmap content from planning documents

## Stack

- **Schema:** Drizzle ORM with PostgreSQL (`shared/schema.ts`)
- **Storage:** Class-based data access layer (`server/storage.ts`)
- **Routes:** Express.js with role-based middleware (`server/routes.ts`)
- **UI:** React with TanStack Query for data fetching (`client/src/pages/roadmap.tsx`)
- **Validation:** Zod schemas generated from Drizzle table definitions
