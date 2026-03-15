# Platform-wide UI Execution Plan

Date: 2026-03-15
Project: `Platform-wide UI and UX Opportunity Analysis`

## Purpose

Turn the current UI opportunity-analysis project into an execution-ready delivery plan that can drive the platform to completion.

The platform already has broad feature coverage across association setup, residential records, governance, finance, operations, communications, documents, onboarding, roadmap administration, and the owner portal. The main remaining risk is not missing modules. It is uneven UX quality across those modules.

## Current Review Summary

### Strengths

- The product already has meaningful route coverage across the platform.
- Association context exists and is reused in a large portion of the admin surface.
- The UI toolkit already includes primitives for breadcrumbs, command surfaces, skeletons, pagination, sheets, drawers, dialogs, and tables.
- Several operational modules already contain real workflows, not placeholder screens.

### Blocking Gaps

1. Shell-level wayfinding is incomplete.
   - The app has a large sidebar, but no shared breadcrumb/header system is actually wired into pages.
   - Adjacent actions and workflow shortcuts are inconsistent across the app.

2. Association context is present but not consistently visible at the moment a user makes a decision.
   - Users can be scoped to an association, but many pages still feel like standalone tools instead of part of a coherent workspace.

3. Table-heavy screens are inconsistent and low-throughput.
   - Many pages render dense tables with limited sorting, filtering, pagination, or row-detail patterns.
   - Operators often need to leave list context to complete or inspect work.

4. Form experiences are still mostly CRUD-shaped instead of task-shaped.
   - Several pages ask users to understand record structure rather than guiding them through the intended operating flow.

5. Loading, empty, error, and completion states are not standardized.
   - Some pages have good mutation feedback and some do not.
   - Query-driven pages vary widely in how clearly they communicate loading, failure, and no-data conditions.

6. Mobile and narrow-layout handling is uneven for admin workflows.
   - Wide tables and multi-column operating pages are not consistently designed for constrained screens.

## Product Decision

This project should now be treated as a UI modernization and workflow-completion project, not a generic analysis project.

The implementation backbone should be:

1. establish shared shell and state patterns
2. apply them to the highest-frequency admin workflows
3. convert dense screens into faster operating flows
4. finish cross-platform feedback and mobile behavior

## Execution Architecture

### Shared UI Building Blocks

These are the reusable pieces that should be built first and then applied across the app:

- `WorkspacePageHeader`
  - breadcrumb trail
  - page title
  - short page summary
  - association-context label
  - adjacent workflow shortcuts
  - primary action slot

- `AssociationScopeBanner`
  - current association
  - scope explanation
  - fast switch action
  - “not in context” warning state

- `CommandPalette`
  - navigation
  - recent records
  - create actions
  - association switching

- `DataTableShell`
  - search
  - filters
  - sorting
  - pagination
  - empty state
  - loading state
  - row actions

- `RecordDetailPanel`
  - right-side detail view
  - recent activity
  - related records
  - quick actions

- `TaskFlowSection`
  - guided form framing
  - prerequisites
  - progress checkpoints
  - success confirmation

- `AsyncStateBoundary`
  - standardized loading, empty, error, and retry treatment

- `ActionFeedbackRail`
  - upload progress
  - export progress
  - sync progress
  - success/failure summary

## Delivery Waves

### Wave 1: Shell, Wayfinding, and Context Foundation

Goal:
Create the common workspace frame the rest of the project will use.

Deliverables:

- Build `WorkspacePageHeader`
- Build `AssociationScopeBanner`
- Wire shared breadcrumbs into all admin pages
- Add page summaries and adjacent shortcuts to top-level routes
- Make association scope visibly persistent across pages
- Add a command palette using the existing command primitive

Pages to apply first:

- dashboard
- association context
- roadmap
- documents
- financial ledger
- communications
- operations dashboard

Exit criteria:

- every primary admin page has a consistent header
- every scoped page shows current association context clearly
- command palette can navigate and start core actions

### Wave 2: Data-heavy Workspace Throughput

Goal:
Reduce context loss and make heavy admin tables faster to work through.

Deliverables:

- Build `DataTableShell`
- Add sorting/filtering/pagination to major tables
- Add row detail side panels for high-frequency record inspection
- Improve wide-table responsive behavior

Pages to apply first:

- vendors
- work orders
- inspections
- maintenance schedules
- financial invoices
- financial ledger
- documents
- governance compliance
- board packages

Exit criteria:

- all major tables use a common list pattern
- users can inspect details without losing list context
- no core admin table is desktop-only by layout assumption

### Wave 3: Guided Workflows and Documents

Goal:
Turn dense CRUD surfaces into clearer operating flows.

Deliverables:

- Build `TaskFlowSection`
- Reframe document upload/metadata/version flows
- Reframe onboarding invite/review flows around next best action
- Reframe association setup and record-entry flows where user order matters

Pages to apply first:

- documents
- onboarding invite
- association context
- financial invoices
- work orders
- board packages

Exit criteria:

- document workflows feel publication-oriented, not file-table-oriented
- onboarding and review surfaces clearly explain what happens next
- multi-step flows expose clear progress and completion points

### Wave 4: Feedback, Trust, and Completion States

Goal:
Make platform behavior legible during loading, failure, and asynchronous work.

Deliverables:

- Build `AsyncStateBoundary`
- Build `ActionFeedbackRail`
- Standardize query loading and retry patterns
- Standardize mutation success/error treatment
- Add progress feedback for uploads, exports, and scheduled/sync actions
- Pair analytics and dashboards with explanations and recommended next steps

Pages to apply first:

- ai ingestion
- communications
- financial payments
- executive
- roadmap
- owner portal

Exit criteria:

- all query-driven pages have clear loading/empty/error states
- long-running actions always expose progress or completion feedback
- analytics modules explain what the operator should do next

## Completion Sequence by Roadmap Task

The current roadmap tasks should be executed in this order:

1. Add shell-level breadcrumbs, page summaries, and adjacent workflow shortcuts
2. Redesign association context switching to be more explicit and less error-prone
3. Create a global command palette for navigation, recent records, and create actions
4. Standardize loading, error, and retry states for query-driven pages
5. Add explicit progress and completion feedback for exports, uploads, and sync actions
6. Standardize sortable, filterable, paginated tables across operations and finance
7. Introduce drill-in side panels and row detail views to reduce context loss
8. Improve responsive behavior for wide admin and operations views
9. Turn dense CRUD forms into guided, task-oriented flows
10. Upgrade document workflows with stronger metadata affordances and file handling
11. Refine onboarding and review consoles around next-best-action workflows
12. Pair analytics with explanations and recommended next actions

## Recommended First Execution Chunk

Start with a foundation chunk rather than jumping page by page.

Chunk A:

- build `WorkspacePageHeader`
- build `AssociationScopeBanner`
- build `AsyncStateBoundary`
- wire them into:
  - dashboard
  - association context
  - documents
  - financial ledger
  - communications

This chunk creates the shared visual and behavioral language the rest of the project can reuse.

## Verification Standard

Each wave should be verified by:

- `npm run check`
- desktop walkthrough across the touched pages
- narrow-width walkthrough for table and form pages
- explicit before/after confirmation that:
  - page context is clearer
  - important actions are easier to reach
  - loading/error/empty states are visible
  - the user can stay oriented while moving between records

## Project Close Criteria

The project should be considered complete only when:

- all roadmap tasks are implemented, not just analyzed
- the shell and page patterns are visibly consistent across the app
- the highest-frequency admin workflows have shared list, detail, and state patterns
- onboarding, documents, finance, operations, and communications each have guided operating flows
- platform-wide feedback states are standardized and trustworthy
