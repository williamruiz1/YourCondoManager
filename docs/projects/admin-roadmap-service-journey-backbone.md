# Admin Roadmap Service Journey Backbone

## Purpose
Establish a repeatable planning rhythm for product work:
- clarify service intent first
- review the user journey second
- capture findings and opportunities in full
- translate those findings into a structured roadmap project
- implement in chunks only after the plan is explicit

This document should be used as the backbone for future Admin roadmap planning work, especially when a request starts from a user/service outcome rather than a narrow code change.

## Standard Planning Sequence

### 1. Service Intent
Define the intended service clearly before discussing screens or schema.

Required outputs:
- target user
- operating model
- level of autonomy
- write vs review authority
- risk posture
- success definition

Example prompts:
- Is this an oversight tool or an operator workspace?
- Should the user review, request, approve, or directly write?
- Is the system serving managed, semi-managed, or self-managed associations?

### 2. Journey Review
Review the current implementation from the user's perspective, not the codebase's perspective.

Required outputs:
- entry points
- activation path
- first-use experience
- recurring-use experience
- trust and security moments
- failure / confusion points
- missing operating actions

Review lens:
- What did the user come here to do?
- What blocks them from doing it cleanly?
- Where does the product expose data without helping the user act?

### 3. Findings
Capture concrete findings ordered by user impact.

Required outputs:
- issue statement
- user consequence
- why it matters to the intended service
- evidence reference if available

Good finding format:
- current behavior
- gap against intended service
- user impact

### 4. Product Decisions
Resolve the key policy and operating questions before implementation planning.

Required outputs:
- access model decision
- workflow authority decision
- lifecycle/state decision
- auditability decision
- scope boundary decision

This step turns vague opportunities into implementation-grade direction.

### 5. Opportunity Breakdown
Translate findings into service opportunities.

Required outputs:
- opportunity statement
- user value
- operating value
- implementation implications
- dependencies

Preferred opportunity categories:
- trust and access
- action-first workflow
- state and lifecycle clarity
- activity and auditability
- high-frequency operating loops
- verification and rollout

### 6. Implementation Plan
Break the work into chunks that can ship and verify incrementally.

Required outputs:
- workstreams
- tasks
- priorities
- sequencing
- verification expectations

Chunking principles:
- foundation before breadth
- lifecycle before polish
- activity/state before automation
- verification before closure

### 7. Roadmap Capture
Create a live Admin roadmap project that mirrors the planning structure.

Required outputs:
- project title
- project description
- workstreams matching the planning sequence
- tasks that map one-to-one to real implementation chunks
- explicit verification tasks

### 8. Execution Rhythm
Implementation should follow the project in chunks.

Per chunk:
- implement one coherent slice
- verify it
- update roadmap task status
- note remaining gaps honestly

## Agent Bootstrap Backbone
Repeated agent setup work should be treated as product debt and operationalized, not re-done manually forever.

For roadmap-oriented work, use this additional agent rhythm:

### 1. Bootstrap Snapshot
Capture a compact, reusable workspace snapshot before deep work begins.

Required outputs:
- current route and module surface
- key schema and storage touchpoints
- active roadmap project context
- known environment prerequisites
- known repo-specific working rules

Preferred implementation:
- a machine-readable workspace manifest
- a generated summary that can be refreshed when the repo changes materially

### 2. Reusable Working Memory
Persist the findings that agents repeatedly rediscover.

Required outputs:
- recurring setup steps
- stable architectural facts
- known verification commands
- common workflow entry points
- recent product decisions that affect implementation

Working rule:
- store stable facts once
- refresh only when drift is detected
- avoid treating temporary findings as durable truth

### 3. Friction Logging
Every repeated setup task should become an explicit improvement input.

Capture:
- what had to be re-discovered
- why it was needed
- whether it could have been precomputed
- what automation or documentation would eliminate it next time

Preferred sinks:
- Admin roadmap project tasks
- analysis run/version records
- durable project docs tied to the roadmap backbone

### 4. Closed-Loop Improvement
The system should improve after each meaningful interaction, not only when a human explicitly asks.

Examples:
- refresh the workspace snapshot when routes or schema change
- append newly discovered stable facts to the reusable memory layer
- create or update roadmap tasks when repeated friction appears
- add verification expectations when an agent had to infer too much

### 5. Governance
Self-amending behavior must stay bounded.

Rules:
- automate discovery and planning first
- do not silently change product behavior just because a task was repetitive
- require explicit implementation tasks for code or schema changes
- separate stable repo knowledge from speculative advice
- keep the roadmap as the source of truth for improvement priorities

## Recommended Workstream Template
Use this shape for service-oriented roadmap projects:

1. Service Intent and Operating Model
2. Journey Review and Findings Capture
3. Product Decisions and Scope Boundaries
4. Foundation and Access Model
5. Workspace and Core Workflows
6. Activity, State, and Auditability
7. Verification, Rollout, and Closure

## Definition of Ready
A service-oriented implementation project is ready only when:
- the intended service is named clearly
- the target user and operating mode are explicit
- findings are captured from the user's perspective
- product decisions are made on authority and boundaries
- implementation is chunked into a roadmap project

## Definition of Done
A service-oriented implementation project is done only when:
- the intended user journey is materially supported
- lifecycle/state behavior is explicit
- activity and auditability support the operating model
- verification is executed, not implied
- roadmap status reflects reality

## Working Rule
Do not jump straight from request to implementation when the request changes the service model, user role, or operating workflow.

Plan first.
Implement next.
Verify before closure.

Also:
- when repeated agent setup work appears, convert it into backbone automation work instead of normalizing the repetition
- update the roadmap and durable planning artifacts so the next interaction starts with more context and less rediscovery

## Active Roadmap Project: Mobile Optimization

### Project Description
Optimize the platform for mobile use across owner, board, manager, admin, and shared communication/document experiences so the product works as a primary responsive web application rather than a desktop-first interface squeezed into small screens.

### Workstream 1: Mobile Foundations And Shared UI Standards
Tasks:
- Audit shared spacing, typography, touch target, and breakpoint patterns across shared components and key pages
- Define mobile layout standards for page headers, section spacing, cards, tab bars, drawers, button groups, and sticky actions
- Standardize responsive behavior for tables by converting dense tables into prioritized mobile list or card patterns
- Standardize responsive behavior for forms with single-column defaults, persistent labels, inline validation, and keyboard-safe layouts
- Standardize mobile-safe patterns for filters and low-frequency controls using drawers, sheets, or expandable sections
- Create a reusable mobile section shell for pages with headers, status, actions, and long content
- Document the mobile UI rules in a durable shared guidance artifact

### Workstream 2: Global Navigation, Authentication, And Session Flows
Tasks:
- Review mobile behavior for login, OTP, association selection, and workspace switching
- Simplify stacked auth screens so each step fits within the viewport cleanly
- Standardize mobile navigation patterns for owner, board, manager, and admin contexts
- Review fixed headers, sticky submenus, and bottom navigation so they do not overlap content
- Ensure tab changes and subpage changes reset or preserve scroll intentionally
- Make portal context switching between units and associations mobile-friendly
- Verify safe-area spacing and bottom-nav behavior on phone-sized screens

### Workstream 3: Owner Portal Mobile Experience
Tasks:
- Audit `overview`, `financials`, `maintenance`, `documents`, and `notices` on common mobile widths
- Refine overview subpage layout so summary, owner info, and occupancy work cleanly in narrow viewports
- Ensure owner info and occupancy forms are single-column, labeled, and easy to edit and save on mobile
- Optimize unit selection for touch interaction and horizontal scrolling
- Simplify financials into a statement-first mobile flow with balance, pay action, recent transactions, and payment setup
- Convert dense financial history tables into mobile-friendly transaction cards or prioritized rows
- Review maintenance submission and request history for attachment handling, long text, and status readability
- Review document and notice views for readable typography, download actions, and expansion behavior
- Verify mobile behavior for bottom tab navigation and long-scrolling content

### Workstream 4: Board Workspace Mobile Experience
Tasks:
- Audit board landing, agenda, tasks, meeting summaries, approvals, packages, and activity views on mobile
- Identify board workflows that should support mobile review versus desktop-only authoring
- Collapse dense governance dashboards into prioritized cards with progressive disclosure
- Convert board activity feeds and approval queues into mobile-first list patterns
- Review attachments, packets, and long-form content for readable mobile access
- Ensure board actions such as approve, review, comment, and open detail remain reachable on mobile
- Define which board workflows should explicitly show desktop-preferred messaging

### Workstream 5: Manager And Admin Workspace Mobile Experience
Tasks:
- Audit admin dashboard, work queues, maintenance triage, communications, financial review, and association switching on mobile
- Break large multi-panel dashboards into mobile stacks ordered by urgency
- Move filter-heavy or configuration-heavy controls into drawers or dedicated subviews
- Convert operational tables into mobile queue cards with visible status, scope, and next action
- Review multi-step admin forms for mobile-safe progression and save states
- Ensure core operational tasks can be completed on mobile: acknowledge, assign, update status, send notice, review account, open record
- Mark workflows that are truly desktop-first and provide explicit handoff messaging instead of poor mobile fallbacks

### Workstream 6: Resident, Shared Content, And Cross-Role Communication Surfaces
Tasks:
- Audit notices, announcements, documents, communication history, and resident-facing content on mobile
- Improve readability for message cards, timelines, attachments, and metadata
- Ensure document previews, download actions, and filenames behave cleanly on small screens
- Standardize mobile treatment for badges, statuses, timestamps, and association or unit labels
- Review empty states and success states so they stay concise on small screens
- Ensure shared content components do not rely on desktop-only table layouts

### Workstream 7: Data Density, Performance, And Interaction Quality
Tasks:
- Identify screens with excessive card stacking, redundant summaries, or repeated data blocks
- Reduce duplicate status surfaces and keep one primary decision area per screen
- Audit heavy tables, long feeds, and expensive panels for mobile performance impact
- Improve perceived performance with progressive loading and lighter default states where needed
- Review tap targets, scroll traps, nested scroll areas, and overlap with sticky UI
- Ensure modals, drawers, selects, and date pickers behave correctly with the mobile keyboard

### Workstream 8: QA, Verification, And Rollout
Tasks:
- Define a core mobile viewport matrix for 320px, 375px, 390px, 430px, and 768px widths
- Create a role-based mobile test checklist for owner, board, manager, admin, and shared public/auth flows
- Add manual verification scripts for the highest-frequency mobile journeys
- Capture before and after screenshots for major workstreams
- Identify candidate UI regression coverage for mobile-critical flows if automation is added
- Establish a release gate that requires mobile verification on touched role surfaces
- Track unresolved desktop-only workflows explicitly so they are not misrepresented as mobile-ready

### Priority Guidance
- P0: auth, navigation, owner portal overview, owner portal financials, owner portal maintenance, shared form standards, and mobile-safe action placement
- P1: admin queues, shared content surfaces, documents and notices, mobile transaction history, and manager triage flows
- P2: board deep workflows, desktop-preferred boundary cleanup, and longer-tail responsive refinements
