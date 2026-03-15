# Agent Bootstrap Backbone Generic Template

## Last Updated
- 2026-03-15: Added startup protocol requirements, startup instruction surface, and startup loading-order workbook fields.
- 2026-03-15: Added metrics snapshot, closeout, and bounded friction-to-planning sync guidance.
- 2026-03-15: Expanded the workbook, porting checklist, and acceptance checklist to reflect implemented backbone automation.

## Purpose
Define a reusable operating pattern for AI-agent-assisted product development that reduces repeated setup work, preserves stable project knowledge, and keeps planning, documentation, and implementation aligned through a live roadmap or equivalent planning system.

This document is written as a generic template that can be adapted to another project.

## Problem Statement
In agent-assisted software projects, a large amount of time is repeatedly spent on the same startup tasks:
- rediscovering repo structure
- re-reading project instructions
- locating schema, route, and service entry points
- reconstructing roadmap or planning context
- inferring verification commands
- re-learning product and planning decisions that were already established previously

This repeated discovery creates waste, slows implementation, and makes agent output less consistent across sessions and across different agents.

## Desired Outcome
The project should maintain a self-improving backbone that:
- gives agents a compact startup context immediately
- preserves stable facts separately from transient task notes
- ties planning and implementation work into a live roadmap or equivalent planning system
- keeps documentation, capability model, and execution status synchronized
- converts repeated friction into explicit improvement work

## System Overview
The backbone is composed of six coordinated layers:

1. Planning system backbone
- The roadmap, project tracker, or equivalent system is the operational source of truth for improvement work.
- Repeated setup costs become visible work items instead of remaining invisible.

2. Planning backbone
- Service-oriented work follows a repeatable plan-first rhythm.
- Requests that affect workflow, role model, scope, or operating behavior are translated into explicit planning structure before implementation.

3. Bootstrap snapshot
- A generated startup artifact gives agents the current route or surface map, backend anchors, schema anchors, environment rules, and active planning context.

4. Durable working memory
- A separate generated artifact preserves stable facts that should outlive a single task session.
- This layer excludes speculative, temporary, or debugging-specific notes.

5. Capability model
- A feature tree, domain map, service map, or capability model expresses the intended system structure and current implementation posture.
- Planning-system completion updates parts of the capability model automatically or semi-automatically.

6. Documentation ingestion and synthesis
- Core documentation, roadmap documents, and selected implementation plans are parsed or referenced into the capability model so planning artifacts remain discoverable in the same conceptual surface.

## Core Artifact Types

### Planning backbone
- a durable planning standard document

### Generated bootstrap artifacts
- a startup manifest
- a durable-memory artifact
- an optional metrics snapshot artifact
- a short README that explains refresh rules and separation rules

### Generators
- a manifest generator script
- a durable-memory generator script
- an optional metrics generator script
- an optional friction-to-planning sync script

### Startup instruction surface
- an agent instruction surface that tells new sessions which backbone artifacts to load first
- a documented startup loading order for bootstrap context and guardrails

### Backbone planning project
- a visible project or initiative dedicated to agent bootstrap and continuous improvement

### Capability model and synthesis
- a source definition of the target capability structure
- a synthesis layer that merges documentation and planning state
- a UI or reporting surface that exposes the synthesized capability model

## Interdependent Systems Required
The backbone does not function properly as a standalone document pattern. It depends on a small set of adjacent systems that must exist or be intentionally substituted.

### 1. Planning system
Required role:
- stores initiatives, workstreams, tasks, status, and completion state
- exposes enough structured data for automation to read and update improvement work

Minimum capabilities:
- create or update projects programmatically
- group work into workstreams or epics
- track task status and completion
- expose stable identifiers or titles for status-rule mapping

Possible implementations:
- database-backed internal roadmap
- Jira, Linear, Asana, or equivalent
- structured markdown or YAML planning store if no external system exists

### 2. Documentation system
Required role:
- stores durable intent, architecture, scope, and planning documents
- provides a stable source for capability synthesis and durable memory

Minimum capabilities:
- durable storage for long-form docs
- stable paths or IDs
- predictable structure for selected documents

Possible implementations:
- repo markdown docs
- wiki with exportable structured content
- CMS or knowledge base with API access

### 3. Capability-model system
Required role:
- stores or derives the target system model
- provides a structure that planning and documentation can map into

Minimum capabilities:
- module/domain grouping
- sub-capability grouping
- item-level status representation
- ability to attach documentation and planning references

Possible implementations:
- feature tree
- service map
- domain model registry
- capability catalog

### 4. Bootstrap artifact generation system
Required role:
- scans the codebase or project surface
- generates machine-readable startup context

Minimum capabilities:
- read project files or metadata
- emit structured output
- run on demand and in automation

Possible implementations:
- local scripts
- CI jobs
- internal developer tooling service

### 4a. Agent startup protocol system
Required role:
- makes backbone usage the default at session start instead of relying on agent rediscovery
- defines the loading order for bootstrap context, durable memory, and guardrails

Minimum capabilities:
- a stable instruction surface that agents are expected to read
- explicit startup ordering
- refresh guidance when generated artifacts drift

Possible implementations:
- repo-level agent instructions
- IDE task bootstrap notes
- session wrapper scripts
- internal agent runtime startup hooks

### 5. Durable-memory system
Required role:
- stores only stable, reusable operational knowledge
- remains separate from transient session notes

Minimum capabilities:
- machine-readable output
- refresh path
- explicit separation rules

Possible implementations:
- generated JSON or YAML in repo
- database-backed memory store
- versioned config documents

### 6. Analysis or telemetry system
Required role:
- records repeated friction and setup cost over time
- supports future closed-loop improvement

Minimum capabilities:
- capture event metadata
- classify recurring friction
- retain historical records

Possible implementations:
- analysis tables
- structured logs
- issue tracker integration
- telemetry pipeline

### 7. Admin or reporting UI
Required role:
- exposes roadmap state, capability model, and improvement work to humans
- gives operators visibility into whether the backbone is working

Minimum capabilities:
- view roadmap projects
- view capability model
- inspect status and open tasks
- optionally trigger refreshes or regeneration

## Conceptual Model

### 1. Documentation
Documentation defines the intended platform, product, or service:
- target architecture or capability write-up
- future roadmap documents
- project-specific plans, reviews, decisions, and gap analyses

Documentation answers:
- what the system is supposed to become
- what capabilities exist conceptually
- what remains in scope, future scope, or gap state

### 2. Roadmap or Planning System
The planning system defines execution reality:
- initiatives or projects
- workstreams or epics
- tasks or tickets
- status
- completion

The planning system answers:
- what work is actively planned
- what is currently being built
- what has been completed or archived
- what is operationally prioritized

### 3. Capability Model
The capability model is the synthesis layer between documentation and execution.

It answers:
- what capabilities exist in the target model
- which capabilities are active, partial, or inactive
- what documentation supports each capability area
- which planned initiatives change capability status

### 4. Bootstrap Backbone
The bootstrap backbone is the execution-assistance layer for agents.

It answers:
- where agents should start
- what project facts are stable
- what commands are normally used
- what planning context is currently active
- what recurring friction should be removed next

## Dependency Topology
The backbone should be understood as a graph of systems, not a single feature.

Recommended dependency flow:

1. Source systems
- codebase
- planning system
- documentation system
- capability-model definition

2. Derived systems
- bootstrap manifest
- durable memory
- synthesized capability status

3. Operational systems
- admin or reporting UI
- analysis or telemetry store
- automation scripts or jobs

The expected flow is:
- codebase and docs produce bootstrap context
- docs and planning system produce capability status
- repeated friction produces analysis records
- analysis and planning system produce future backbone work

If one of these systems is missing, the backbone becomes partially degraded rather than fully functional.

## System Contracts

### Contract 1: Planning system to capability model
Inputs:
- project or initiative identifiers
- project status
- completion state

Outputs:
- capability status updates such as active, partial, inactive, planned, blocked, or complete

Requirement:
- planning identifiers used in status rules must be stable enough not to break capability mapping frequently

### Contract 2: Documentation system to capability model
Inputs:
- capability documents
- implementation plans
- gap analyses
- architecture notes

Outputs:
- summaries
- intent statements
- stories
- notes
- scope boundaries

Requirement:
- selected documents must follow a sufficiently predictable structure for parsing or referencing

### Contract 3: Codebase to bootstrap manifest
Inputs:
- route definitions
- module locations
- backend anchors
- environment configuration

Outputs:
- machine-readable startup context

Requirement:
- route or surface definitions must be discoverable from a stable project location or configuration

### Contract 4: Bootstrap manifest to durable memory
Inputs:
- startup context
- planning backbone
- active project context

Outputs:
- stable facts
- preferred commands
- workflow entry points
- recurring known issues

Requirement:
- durable memory must not copy unstable or one-off runtime output without promotion rules

### Contract 4a: Startup protocol to agent behavior
Inputs:
- startup instructions
- bootstrap manifest
- durable memory
- guardrails or safety rules

Outputs:
- consistent session-start loading behavior
- lower setup rediscovery cost
- safer use of backbone automations

Requirement:
- the startup protocol must live in a stable instruction surface that is available at the beginning of new sessions

### Contract 5: Analysis system to planning system
Inputs:
- repeated friction observations
- setup cost patterns
- recurring rediscovery events

Outputs:
- suggested work items
- created or updated backbone tasks

Requirement:
- friction signals must be deduplicated and thresholded before they are allowed to create planning noise

## How Documentation, Planning, and Capability Model Work Together

### Documentation-to-Capability flow
The project should define a source capability structure and a synthesis layer that:
- seeds the capability model from a durable definition
- parses or references selected documentation
- applies inferred summaries, stories, or descriptions
- resolves planning-linked status rules
- produces a capability-model response used in the planning or admin UI

This creates a single capability surface that combines:
- intended product or service model
- project-specific documentation
- implementation and gap-analysis documents
- planning-derived completion state

### Planning-to-Capability flow
Certain capability nodes should have planning rules that state:
- which initiative or project titles affect capability state
- what state should be shown when the project is missing
- what state should be shown when the project is in progress
- what state should be shown when the project is complete

The synthesis layer resolves these rules by querying the planning system and mapping project completion into capability state.

This means the capability model is not static documentation. It reacts to execution.

### Documentation-to-Planning flow
The planning backbone requires product or service requests to be translated into a live planning initiative.

That means documentation is not treated as an endpoint. It must produce:
- project title
- project description
- workstreams
- tasks
- verification expectations

### Planning-to-Documentation flow
When major planning or implementation insights are discovered, they can be promoted back into:
- planning backbone docs
- project review docs
- gap-analysis docs
- durable bootstrap memory

This closes the loop between what is learned and what is institutionalized.

## What the Backbone Achieves

### Operational benefits
- reduces startup rediscovery time for every agent session
- improves consistency across multiple agents
- makes planning decisions durable instead of conversational
- gives implementation work an explicit planning home
- exposes repeated friction as a visible improvement backlog

### Product-management benefits
- keeps service intent, planning structure, and implementation slices aligned
- avoids jumping straight from vague request to code
- keeps capability modeling connected to real execution state
- preserves a stronger audit trail for why work exists

### Documentation benefits
- centralizes stable project knowledge
- separates stable facts from temporary notes
- keeps “how this project works” easy to regenerate

## Functional Requirements

### A. Planning-system backbone requirements
1. The system must support a dedicated project or initiative for agent bootstrap and continuous improvement.
2. Repeated agent setup friction must be representable as workstreams and tasks.
3. Backbone work must be visible in the same planning system used for product work.
4. Planning tasks must support status, priority, effort, and completion tracking.

### B. Planning backbone requirements
1. Service-oriented requests must be translated into explicit planning projects before major implementation work begins.
2. The planning standard must define:
- service intent
- journey review
- findings
- product decisions
- opportunity breakdown
- implementation plan
- planning capture
- verification rhythm
3. Repeated setup work must be explicitly classified as operational debt and routed into the backbone project.

### C. Bootstrap snapshot requirements
1. The system must generate a machine-readable startup snapshot.
2. The snapshot must include:
- route or surface map
- page or module inventory
- backend anchor files
- schema or data-model anchors
- environment prerequisites
- standard commands
- selected active planning context
3. The snapshot must be regenerable via a single command.
4. The snapshot must define refresh triggers.

### D. Durable working memory requirements
1. The system must generate a separate durable-memory artifact.
2. Durable memory must contain only stable, repeatedly useful facts.
3. Durable memory must explicitly exclude:
- speculative notes
- task-specific debugging trails
- temporary findings not accepted into durable project artifacts
4. Durable memory must include:
- stable project facts
- preferred commands
- verification paths by change type
- workflow entry points
- long-lived product decisions
- recurring project issues
- current active planning context

### E. Capability-model integration requirements
1. The capability model must reflect the intended product or service structure.
2. The capability model must support documentation-derived nodes and summaries.
3. Capability status must be able to respond to planning-system project completion.
4. Capability-model output must be consumable by the project’s planning, admin, or reporting UI.

### F. Automation requirements
1. The project must support command-based regeneration of bootstrap artifacts.
2. Bootstrap automation must be idempotent.
3. Backbone planning work must be seedable or refreshable by script or equivalent automation.
4. The project must define a startup protocol that tells agents which backbone artifacts to load before deep exploration.
5. The system should support friction logging and work-item generation.
6. The system should support metrics capture for startup-cost reduction and backbone adoption.

### G. Inter-system dependency requirements
1. The planning system, documentation system, and capability model must each have a clearly named owner, even if the same team owns all three.
2. The project must document where stable identifiers come from for:
- planning items
- capability nodes
- source documents
- generated artifacts
3. The project must define what happens when one dependency is unavailable or stale.
4. The project must define which systems are read-only for the backbone and which are allowed to be written by automation.
5. The project must define promotion rules for moving information from transient observations into durable memory or planning artifacts.

## Non-Functional Requirements

### Durability
- The system must preserve stable context across sessions.
- Generated artifacts must be committed or otherwise persisted in a durable, inspectable location.

### Safety
- Self-amending behavior must be bounded to planning and backbone artifacts unless broader implementation work is explicitly authorized.
- Stable memory must not silently absorb speculative information.

### Transparency
- Generated memory and manifest artifacts must be human-readable.
- The boundary between durable and transient knowledge must be explicit.

### Maintainability
- Artifact generation must be implemented in small, inspectable scripts or services.
- Refresh behavior must be simple enough to run locally or in CI.

### Extensibility
- The pattern must support future layers such as:
  - friction logging
  - analysis-run capture
  - auto-suggested planning updates
  - project-specific memory overlays

### Resilience
- The backbone should degrade gracefully when one dependent system is missing, stale, or unavailable.
- Generated artifacts should still be usable even if planning-state enrichment or capability synthesis is temporarily incomplete.

### Ownership
- Each dependent system should have a documented owner and refresh responsibility.
- Regeneration commands and failure-handling expectations should not depend on tribal knowledge.

## Data and Artifact Requirements

### Generated bootstrap manifest
Minimum fields:
- generated timestamp
- repository or project root and key files
- environment requirements
- primary commands
- route or surface inventory
- page or module inventory
- backend anchors
- planning context
- refresh triggers

### Durable memory
Minimum fields:
- generated timestamp
- source artifacts
- separation rule
- stable project facts
- preferred commands
- verification by change type
- workflow entry points
- current product decisions
- recurring project issues
- active planning context

### Planning entities
The planning system must support:
- projects or initiatives
- workstreams or epics
- tasks or tickets
- status updates
- completion updates

### Capability-model entities
The capability-model system must support:
- modules or domains
- feature sets or capability groups
- functional units or capability items
- documentation notes
- stories or intent summaries
- inferred descriptions
- planning-derived status rules

### Inter-system metadata
The project should also maintain:
- dependency map of participating systems
- ownership map
- refresh triggers by system
- startup loading order and instruction surface
- read/write boundaries for each automation
- failure handling notes for partial refresh conditions

## Recommended Automations

### 1. Bootstrap generation
Provide a single command such as:
```bash
npm run bootstrap:agent
```

Recommended behavior:
- regenerate startup manifest
- regenerate durable memory

### 2. Session-start loading
Define an instruction surface that makes the startup order explicit.

Recommended behavior:
- load bootstrap manifest first
- load durable memory second
- load planning backbone docs when the task affects planning or workflow structure
- load guardrails before any backbone write automation

### 3. Backbone planning seeding
Provide an idempotent script or automation that can create or refresh the backbone planning project.

### 4. Capability-model synthesis
Implement a synthesis layer that can:
- parse selected docs
- build capability-model output
- apply status rules from planning state

### 5. Planning-aware capability status
Allow planning completion to change capability status automatically or semi-automatically.

### 6. Friction logging and closeout
Provide bounded commands or jobs that can:
- log repeated setup friction into analysis or telemetry records
- generate closeout observations or future-run recommendations
- keep write scope limited to backbone artifacts and backbone analysis history

### 7. Metrics snapshots
Provide a command or job that can:
- generate a metrics snapshot for startup-cost reduction and backbone adoption
- persist the snapshot in a durable inspectable location
- optionally record the snapshot into analysis history

### 8. Bounded friction-to-planning sync
Provide a thresholded sync that can:
- inspect repeated friction patterns
- create or update planning tasks in the backbone project only
- refuse to touch non-backbone product work automatically

### 9. Dependency health checks
Add validation that can detect:
- missing source documents
- stale generated artifacts
- broken planning-to-capability mappings
- missing owners or refresh metadata
- invalid or duplicate identifiers used in mappings

## Execution Workflow

### Current implementation pattern
1. Maintain planning standard in the backbone doc.
2. Seed or refresh the backbone planning project.
3. Define startup instructions so new sessions load backbone artifacts first.
4. Generate bootstrap manifest.
5. Generate durable memory.
6. Use these artifacts at the beginning of future work.
7. Deliver new planning or implementation slices through the planning system.

### Intended future workflow
1. Agent starts by following the startup protocol.
2. Agent loads bootstrap manifest and durable memory before deep exploration.
3. Agent performs task work with less rediscovery.
4. Repeated friction is logged into analysis records or equivalent telemetry.
5. Closeout automation records bounded recommendations for future sessions.
6. Repeated patterns produce planning updates automatically or semi-automatically within the backbone project.
7. Backbone artifacts and metrics snapshots are refreshed at closeout.

## Failure and Degradation Modes

### If the planning system is unavailable
- capability status may fall back to default or last-known values
- bootstrap artifacts should still generate from code and docs
- roadmap-improvement automation should stop rather than guess

### If documentation is stale or missing
- capability synthesis may be incomplete
- durable memory should not infer missing facts as truth
- health checks should flag missing sources explicitly

### If bootstrap generation fails
- the previous committed artifact may be used as a fallback
- the failure should be logged as operational debt or a blocking issue

### If durable memory generation fails
- startup manifest can still be used for the current session
- stable-memory refresh should be treated as incomplete rather than silently skipped

### If capability mapping breaks
- the project should fail visibly into “mapping incomplete” rather than publishing misleading status

## Ownership Model

Recommended owners:
- planning backbone owner
- bootstrap automation owner
- durable memory owner
- capability-model owner
- planning-system integration owner
- analysis and telemetry owner

Minimum expectation:
- every generated artifact and every automation command has a named owner
- every cross-system mapping has a maintainer
- every failure mode has an escalation path

## Governance and Guardrails
The backbone may self-amend only within bounded areas:
- generated bootstrap artifacts
- durable memory artifacts
- metrics artifacts
- backbone planning project updates
- planning and backbone documentation

The backbone must not silently self-amend:
- schema
- product behavior
- authorization rules
- business logic
- user-facing workflows

Those changes still require explicit implementation work and verification.

## Success Criteria

### Immediate success criteria
- agents can start from generated bootstrap context
- stable project facts no longer need to be rediscovered manually every time
- backbone work is visible in the planning system
- planning, documentation, and capability model remain aligned

### Medium-term success criteria
- fewer repeated exploratory searches are needed per session
- more planning work is created from recurring friction instead of ad hoc notes
- planning quality is more consistent across different agents

### Long-term success criteria
- friction logging becomes automatic
- analysis data can show what setup cost is being eliminated
- bootstrap and durable memory become standard infrastructure for all future work
- startup protocol is consistently followed by new sessions

## Known Gaps to Plan For
Typical next layers after foundation:
- friction logging into analysis or telemetry tables
- automatic detection of repeated setup patterns
- auto-creation or recommendation of planning tasks from recurring friction
- session closeout summarization into durable memory candidates
- CI enforcement for stale bootstrap artifacts
- startup-protocol enforcement when agents bypass backbone loading

## Minimum Implementation Sequence
1. Write planning backbone doc.
2. Create backbone planning project.
3. Define startup protocol in the agent instruction surface.
4. Add bootstrap manifest generator.
5. Add durable-memory generator.
6. Define refresh command.
7. Document interdependent systems, identifiers, read/write boundaries, and owners.
8. Connect planning state to capability-model status if the project has a capability model.
9. Add friction logging only after durable memory is stable.
10. Add metrics snapshots and bounded friction-to-planning sync after guardrails exist.

## Porting Checklist

### Foundation
- There is a project-level planning standard.
- There is a roadmap or equivalent planning system.
- There is a place to store generated bootstrap artifacts.
- The interdependent systems and owners are named explicitly.
- There is a reliable agent instruction surface for startup behavior.

### Context
- Route map or service surface can be parsed.
- Key backend and data-model anchors can be identified.
- Standard commands are known.
- Startup loading order is documented.

### Memory
- Stable facts can be separated from temporary notes.
- Durable memory can be regenerated without manual editing.

### Governance
- Self-amending behavior is explicitly bounded.
- Product changes still require normal implementation governance.
- Read and write boundaries between dependent systems are documented.

### Improvement loop
- Repeated friction can be observed.
- There is a future path to record friction as analysis and planning work.
- Failure handling for degraded dependency states is defined.
- Metrics capture path is defined.

## Implementation Workbook
Use this section directly when adapting the backbone to another project.

### Project Identity
- Project name: `______________________________`
- Repository root or system name: `______________________________`
- Primary product or service: `______________________________`
- Primary users of the backbone: `______________________________`
- Primary agents or automation actors: `______________________________`

### Planning Backbone
- Planning system used: `______________________________`
- Backbone project or initiative name: `______________________________`
- Planning backbone document path: `______________________________`
- Planning-system owner: `______________________________`
- Backbone project owner: `______________________________`
- What counts as service-oriented work in this project:
  - `____________________________________________________________`
  - `____________________________________________________________`

### Documentation System
- Documentation system used: `______________________________`
- Canonical architecture or capability document: `______________________________`
- Roadmap or future-state documents: `______________________________`
- Implementation-plan documents: `______________________________`
- Documentation owner: `______________________________`
- Documentation refresh cadence: `______________________________`

### Capability Model
- Capability model type:
  - `feature tree / service map / domain catalog / other: __________________`
- Source definition file or system: `______________________________`
- Synthesis layer file or system: `______________________________`
- Capability-model UI or reporting surface: `______________________________`
- Capability-model owner: `______________________________`
- Capability statuses used:
  - `____________________________________________________________`

### Startup Protocol
- Agent instruction surface path or system: `______________________________`
- Required startup loading order:
  - `____________________________________________________________`
  - `____________________________________________________________`
  - `____________________________________________________________`
- When guardrails must be loaded:
  - `____________________________________________________________`
- Who owns startup protocol updates: `______________________________`
- What should trigger startup protocol updates:
  - `____________________________________________________________`
  - `____________________________________________________________`

### Bootstrap Snapshot
- Bootstrap manifest path: `______________________________`
- Bootstrap generator command: `______________________________`
- Source inputs used by the bootstrap generator:
  - `____________________________________________________________`
  - `____________________________________________________________`
  - `____________________________________________________________`
- Refresh triggers:
  - `____________________________________________________________`
  - `____________________________________________________________`
  - `____________________________________________________________`
- Bootstrap artifact owner: `______________________________`

### Durable Memory
- Durable-memory path: `______________________________`
- Durable-memory generator command: `______________________________`
- Stable facts to preserve:
  - `____________________________________________________________`
  - `____________________________________________________________`
  - `____________________________________________________________`
- Facts that must stay out of durable memory:
  - `____________________________________________________________`
  - `____________________________________________________________`
  - `____________________________________________________________`
- Promotion rule from transient observation to durable memory:
  - `____________________________________________________________`
- Durable-memory owner: `______________________________`

### Inter-system Contracts
- Stable planning identifiers come from: `______________________________`
- Stable capability identifiers come from: `______________________________`
- Stable document identifiers or paths come from: `______________________________`
- Bootstrap reads from:
  - `____________________________________________________________`
- Bootstrap writes to:
  - `____________________________________________________________`
- Durable memory reads from:
  - `____________________________________________________________`
- Durable memory writes to:
  - `____________________________________________________________`
- Capability synthesis reads from:
  - `____________________________________________________________`
- Capability synthesis writes to:
  - `____________________________________________________________`

### Verification and Commands
- Primary dev command: `______________________________`
- Primary build command: `______________________________`
- Primary typecheck or lint command: `______________________________`
- Primary test command: `______________________________`
- Planning/backbone refresh command: `______________________________`
- Verification by change type:
  - UI changes: `________________________________________________`
  - backend changes: `___________________________________________`
  - schema changes: `____________________________________________`
  - planning/backbone changes: `_________________________________`

### Analysis and Friction Logging
- Analysis or telemetry system: `______________________________`
- Friction logging owner: `______________________________`
- Friction logging command: `______________________________`
- Closeout command: `______________________________`
- Friction events that should be captured:
  - `____________________________________________________________`
  - `____________________________________________________________`
  - `____________________________________________________________`
- Threshold for turning repeated friction into planning work:
  - `____________________________________________________________`
- How friction becomes roadmap or planning tasks:
  - `____________________________________________________________`

### Metrics and Review
- Metrics artifact path: `______________________________`
- Metrics generator command: `______________________________`
- Friction-to-planning sync command: `______________________________`
- Review cadence for metrics and friction trends: `______________________________`
- Thresholds or rules for bounded task creation:
  - `____________________________________________________________`
  - `____________________________________________________________`
- Who reviews backbone metrics and sync outcomes: `______________________________`

### Ownership and Governance
- Named owner for planning backbone: `______________________________`
- Named owner for bootstrap automation: `______________________________`
- Named owner for durable memory: `______________________________`
- Named owner for capability-model synthesis: `______________________________`
- Named owner for planning integration: `______________________________`
- Named owner for analysis or telemetry: `______________________________`
- Systems the backbone may update automatically:
  - `____________________________________________________________`
- Systems the backbone may never update automatically:
  - `____________________________________________________________`
- Escalation path when generated artifacts or mappings fail:
  - `____________________________________________________________`

### Failure and Degradation Behavior
- If planning system is unavailable:
  - `____________________________________________________________`
- If documentation is stale or missing:
  - `____________________________________________________________`
- If bootstrap generation fails:
  - `____________________________________________________________`
- If durable-memory generation fails:
  - `____________________________________________________________`
- If capability mapping breaks:
  - `____________________________________________________________`

### Success Metrics
- Startup time reduction metric: `______________________________`
- Repeated-search reduction metric: `______________________________`
- Planning-quality metric: `______________________________`
- Backbone adoption metric: `______________________________`
- Friction-to-improvement conversion metric: `______________________________`

### Initial Delivery Plan
- Phase 1 scope:
  - `____________________________________________________________`
- Phase 2 scope:
  - `____________________________________________________________`
- Phase 3 scope:
  - `____________________________________________________________`
- First artifact to implement: `______________________________`
- First automation to implement: `______________________________`
- First health check to implement: `______________________________`

### Acceptance Checklist
- [ ] Planning backbone exists
- [ ] Backbone project exists
- [ ] Startup protocol exists in the agent instruction surface
- [ ] Bootstrap manifest exists
- [ ] Durable memory exists
- [ ] Inter-system contracts are documented
- [ ] Owners are named
- [ ] Read/write boundaries are documented
- [ ] Failure behavior is documented
- [ ] Verification paths are documented
- [ ] Friction logging path is planned
- [ ] Metrics capture path is planned
- [ ] Success metrics are named
- [ ] Refresh command works end-to-end

## Summary
This backbone turns agent startup context from an informal conversational habit into explicit project infrastructure.

The general pattern is:
- documentation defines intended system model
- planning system defines execution reality
- capability model synthesizes documentation and planning state
- bootstrap backbone helps agents start faster and work more consistently

That combination creates a system where planning, implementation, capability modeling, and agent operations reinforce each other instead of drifting apart.
