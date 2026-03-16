# Platform-wide UI Execution Plan

Date: 2026-03-15
Project: `Platform-wide UI and UX Opportunity Analysis`
Status: Archived on 2026-03-15 after the initial modernization wave was closed in the live roadmap

## Purpose

Turn the current UI opportunity-analysis project into an execution-ready delivery plan that can drive the platform to completion.

The platform already has broad feature coverage across association setup, residential records, governance, finance, operations, communications, documents, onboarding, roadmap administration, and the owner portal. The main remaining risk is not missing modules. It is uneven UX quality across those modules.

## Revalidation Note

This document reflects the pre-execution view of the project. As of 2026-03-16, the live roadmap project for this plan is archived and all tasks in that project are marked done.

That archived status should be read as historical project bookkeeping, not proof that every page across the platform now shares the same UX maturity. The shared foundation work shipped, but several rollout and polish concerns described here still exist on pages that never adopted those shared patterns.

Validated interpretation:

- `Create a global command palette for navigation, recent records, and create actions` is complete and should remain closed.
- Shell, association-context, async-state, document, and onboarding tasks landed as first-wave foundation work and should not be reopened wholesale.
- Table, responsive, feedback, and analytics consistency gaps are still real at the platform level, but should be tracked in newer focused projects instead of by reopening this archived analysis project.

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

## Historical Task Outcome

The live roadmap project for this plan has already been closed.

Validated status on 2026-03-16:

1. `Create a global command palette for navigation, recent records, and create actions`
   Complete and correctly closed.
2. `Add shell-level breadcrumbs, page summaries, and adjacent workflow shortcuts`
   Foundation delivered; any remaining work is rollout, not net-new design.
3. `Redesign association context switching to be more explicit and less error-prone`
   Foundation delivered; any remaining work is polish and edge-case cleanup.
4. `Upgrade document workflows with stronger metadata affordances and file handling`
   Core guided document workflow delivered; further metadata/entity-linking polish belongs in a newer project if needed.
5. `Refine onboarding and review consoles around next-best-action workflows`
   Core next-best-action treatment exists; higher-throughput review improvements belong in a newer project if needed.
6. All other tasks listed in this document
   Still conceptually relevant where pages have not adopted the shared patterns, but they should be reintroduced only as targeted follow-on work tied to current gaps.

## Historical First Execution Chunk

The original first chunk centered on `WorkspacePageHeader`, `AssociationScopeBanner`, and `AsyncStateBoundary`, applied first to dashboard, association context, documents, financial ledger, and communications.

That foundation is the clearest part of this plan that shipped and is the main reason this project should remain archived rather than be reopened as-is.

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
