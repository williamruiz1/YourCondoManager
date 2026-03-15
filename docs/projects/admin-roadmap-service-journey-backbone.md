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
