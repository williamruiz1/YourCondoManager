# Agent Bootstrap Backbone Specification and Requirements

## Purpose
Define a reusable operating pattern for AI-agent-assisted product development that reduces repeated setup work, preserves stable project knowledge, and keeps planning, documentation, and implementation aligned through the Admin roadmap.

This specification describes the system as implemented in this repository and is intentionally written so it can be adapted to another project.

## Problem Statement
In agent-assisted software projects, a large amount of time is repeatedly spent on the same startup tasks:
- rediscovering repo structure
- re-reading workflow instructions
- locating schema, route, and storage entry points
- reconstructing roadmap context
- inferring verification commands
- re-learning product/planning decisions that were already established previously

This repeated discovery creates waste, slows implementation, and makes agent output less consistent across sessions and across different agents.

## Desired Outcome
The project should maintain a self-improving backbone that:
- gives agents a compact startup context immediately
- preserves stable facts separately from transient task notes
- ties planning and implementation work into a live roadmap
- keeps documentation, capability model, and execution status synchronized
- converts repeated friction into explicit improvement work

## System Overview
The backbone is composed of six coordinated layers:

1. Admin roadmap backbone
- The roadmap is the operational source of truth for improvement work.
- Repeated setup costs become roadmap workstreams and tasks instead of remaining invisible.

2. Planning backbone
- Service-oriented work follows a repeatable plan-first rhythm.
- Requests that affect workflow, role model, scope, or operating behavior must be translated into explicit roadmap structure before implementation.

3. Bootstrap snapshot
- A generated startup artifact gives agents the current route surface, backend anchors, schema anchors, environment rules, and roadmap context.

4. Durable working memory
- A separate generated artifact preserves stable facts that should outlive a single task session.
- This layer excludes speculative, temporary, or debugging-specific notes.

5. FTPH capability model
- The feature tree expresses the target platform capability model and current implementation posture.
- Roadmap completion updates parts of the feature tree automatically.

6. Documentation ingestion and synthesis
- Core documentation, roadmap documents, and selected implementation plans are parsed and merged into the feature tree so planning artifacts remain discoverable in the same capability surface.

## Core Artifacts in This Repository

### Planning backbone
- `docs/projects/admin-roadmap-service-journey-backbone.md`

### Generated bootstrap artifacts
- `docs/agent-bootstrap/workspace-manifest.json`
- `docs/agent-bootstrap/durable-memory.json`
- `docs/agent-bootstrap/README.md`

### Generators
- `script/generate-agent-bootstrap-manifest.ts`
- `script/generate-agent-durable-memory.ts`

### Admin roadmap bootstrap project
- `Admin Roadmap Backbone - Agent Bootstrap and Continuous Improvement`

### FTPH capability model and synthesis
- `shared/ftph-feature-tree.ts`
- `server/ftph-feature-tree.ts`
- `client/src/pages/roadmap.tsx`
- `docs/roadmap/ftph-v2.1.md`
- `docs/roadmap/phases-6-10.md`

## Conceptual Model

### 1. Documentation
Documentation defines the intended platform:
- FTPH v2.1 defines the target product model
- phases 6–10 defines future roadmap workstreams
- project-specific documents define implementation plans, service decisions, and gap analyses

Documentation answers:
- what the platform is supposed to become
- what capabilities exist conceptually
- what remains in scope, future scope, or gap state

### 2. Roadmap
The roadmap defines execution reality:
- projects
- workstreams
- tasks
- status
- completion

The roadmap answers:
- what work is actively planned
- what is currently being built
- what has been completed or archived
- what is operationally prioritized

### 3. Feature Tree
The feature tree is the synthesis layer between documentation and roadmap execution.

It answers:
- what capabilities exist in the target model
- which capabilities are active, partial, or inactive
- what documentation supports each module, feature set, and functional unit
- which roadmap projects change capability status

### 4. Bootstrap Backbone
The bootstrap backbone is the execution-assistance layer for agents.

It answers:
- where agents should start
- what repo facts are stable
- what commands are normally used
- what planning context is currently active
- what recurring friction should be removed next

## How FTPH, Documentation, Roadmap, and Feature Tree Work Together

### Documentation-to-Feature Tree flow
`shared/ftph-feature-tree.ts` defines the base module, feature-set, and functional-unit structure for the platform capability model.

`server/ftph-feature-tree.ts` enriches that model by:
- seeding modules and defaults from the shared feature-tree definition
- parsing selected docs into documentation-oriented feature sets
- applying inferred stories and summaries
- resolving roadmap-linked status rules
- producing the feature-tree response used in the roadmap UI

This creates a single capability surface that combines:
- published FTPH intent
- repo-specific documentation
- implementation and gap-analysis documents
- roadmap-derived completion state

### Roadmap-to-Feature Tree flow
Certain feature-tree nodes have `roadmapRule` mappings in `shared/ftph-feature-tree.ts`.

These rules state:
- which roadmap project titles affect capability state
- what state should be shown when the project is missing
- what state should be shown when the project is in progress
- what state should be shown when the project is complete

`server/ftph-feature-tree.ts` resolves these rules by querying roadmap projects and mapping project completion into:
- `active`
- `partial`
- `inactive`

This means the capability model is not static documentation. It reacts to execution.

### Documentation-to-Roadmap flow
The planning backbone requires product/service requests to be translated into a live roadmap project.

That means documentation is not treated as an endpoint. It must produce:
- project title
- project description
- workstreams
- tasks
- verification expectations

### Roadmap-to-Documentation flow
When major planning or implementation insights are discovered, they can be promoted back into:
- service-journey backbone docs
- project review docs
- gap-analysis docs
- durable bootstrap memory

This closes the loop between what is learned and what is institutionalized.

## What the Backbone Achieves

### Operational benefits
- reduces startup rediscovery time for every agent session
- improves consistency across multiple agents
- makes planning decisions durable instead of conversational
- gives implementation work an explicit roadmap home
- exposes repeated friction as a visible improvement backlog

### Product-management benefits
- keeps service intent, roadmap structure, and implementation slices aligned
- avoids jumping straight from vague request to code
- keeps capability modeling connected to real execution state
- preserves a stronger audit trail for why work exists

### Documentation benefits
- centralizes stable repo knowledge
- separates stable facts from temporary notes
- keeps “how this project works” easy to regenerate

## Functional Requirements

### A. Admin roadmap backbone requirements
1. The system must support a dedicated roadmap project for agent bootstrap and continuous improvement.
2. Repeated agent setup friction must be representable as roadmap workstreams and tasks.
3. Backbone work must be visible in the same roadmap system used for product work.
4. Roadmap tasks must support status, priority, effort, and completion tracking.

### B. Planning backbone requirements
1. Service-oriented requests must be translated into explicit roadmap projects before major implementation work begins.
2. The planning standard must define:
- service intent
- journey review
- findings
- product decisions
- opportunity breakdown
- implementation plan
- roadmap capture
- verification rhythm
3. Repeated setup work must be explicitly classified as operational debt and routed into the backbone project.

### C. Bootstrap snapshot requirements
1. The system must generate a machine-readable startup snapshot.
2. The snapshot must include:
- route surface
- page modules
- backend anchor files
- schema anchors
- environment prerequisites
- standard commands
- selected active roadmap context
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
- stable repo facts
- preferred commands
- verification paths by change type
- workflow entry points
- long-lived product decisions
- recurring repo issues
- current active roadmap context

### E. FTPH and feature-tree integration requirements
1. The feature tree must reflect the intended capability model.
2. The feature tree must support documentation-derived nodes and summaries.
3. Feature-tree status must be able to respond to roadmap project completion.
4. Feature-tree output must be consumable by the Admin roadmap UI.

### F. Automation requirements
1. The project must support command-based regeneration of bootstrap artifacts.
2. Bootstrap automation must be idempotent.
3. Roadmap backbone work must be seedable or refreshable by script.
4. The system should support future automation for friction logging and roadmap task generation.

## Non-Functional Requirements

### Durability
- The system must preserve stable context across sessions.
- Generated artifacts must be committed or otherwise persisted in a durable, inspectable location.

### Safety
- Self-amending behavior must be bounded to planning/backbone artifacts unless broader implementation work is explicitly authorized.
- Stable memory must not silently absorb speculative information.

### Transparency
- Generated memory and manifest artifacts must be human-readable.
- The boundary between durable and transient knowledge must be explicit.

### Maintainability
- Artifact generation must be implemented in small, inspectable scripts.
- Refresh behavior must be simple enough to run locally or in CI.

### Extensibility
- The pattern must support future layers such as:
  - friction logging
  - analysis-run capture
  - auto-suggested roadmap updates
  - project-specific memory overlays

## Data and Artifact Requirements

### Generated bootstrap manifest
Minimum fields:
- generated timestamp
- repository root and key files
- environment requirements
- primary commands
- route inventory
- page inventory
- backend anchors
- roadmap context
- refresh triggers

### Durable memory
Minimum fields:
- generated timestamp
- source artifacts
- separation rule
- stable repo facts
- preferred commands
- verification by change type
- workflow entry points
- current product decisions
- recurring repo issues
- active roadmap context

### Roadmap entities
The roadmap system must support:
- projects
- workstreams
- tasks
- status updates
- completion updates

### Feature-tree entities
The feature-tree system must support:
- modules
- feature sets
- functional units
- documentation notes
- user stories
- inferred descriptions
- roadmap-derived status rules

## Included Automations in This Repository

### 1. Bootstrap generation
Command:
```bash
npm run bootstrap:agent
```

Current behavior:
- regenerates `workspace-manifest.json`
- regenerates `durable-memory.json`

### 2. Roadmap backbone seeding
Roadmap bootstrap work is made durable with:
- `script/add-agent-bootstrap-backbone-roadmap-project.ts`

This allows the backbone project to be created or refreshed without manual re-entry.

### 3. Feature-tree synthesis
`server/ftph-feature-tree.ts` automates:
- parsing selected docs
- building feature-tree output
- applying status rules from roadmap project state

### 4. Roadmap-aware capability status
`roadmapRule` definitions in `shared/ftph-feature-tree.ts` allow roadmap project completion to change capability state automatically.

## Execution Workflow

### Current implemented workflow
1. Maintain planning standard in the roadmap backbone doc.
2. Seed or refresh the backbone roadmap project.
3. Generate bootstrap manifest.
4. Generate durable memory.
5. Use these artifacts at the beginning of future work.
6. Deliver new planning or implementation slices through the roadmap.

### Intended future workflow
1. Agent starts by loading bootstrap manifest and durable memory.
2. Agent performs task work with less rediscovery.
3. Repeated friction is logged into analysis records.
4. Repeated patterns produce roadmap updates automatically or semi-automatically.
5. Backbone artifacts are refreshed at closeout.

## Governance and Guardrails
The backbone may self-amend only within bounded areas:
- generated bootstrap artifacts
- durable memory artifacts
- backbone roadmap project updates
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
- stable repo facts no longer need to be rediscovered manually every time
- backbone work is visible in the Admin roadmap
- roadmap, documentation, and capability model remain aligned

### Medium-term success criteria
- fewer repeated exploratory searches are needed per session
- more roadmap work is created from recurring friction instead of ad hoc notes
- planning quality is more consistent across different agents

### Long-term success criteria
- friction logging becomes automatic
- analysis data can show what setup cost is being eliminated
- bootstrap and durable memory become standard infrastructure for all future work

## Known Gaps After the Current Slice
The following layers are not yet implemented fully:
- friction logging into analysis tables
- automatic detection of repeated setup patterns
- auto-creation or recommendation of roadmap tasks from recurring friction
- session closeout summarization into durable memory candidates
- CI enforcement for stale bootstrap artifacts

## Reusable Template for Another Project

### Replace these project-specific inputs
- route source file
- schema/source-of-truth files
- roadmap tables or planning system
- capability model or architecture model
- key verification commands
- active planning docs

### Keep these architectural layers
1. planning backbone
2. roadmap improvement project
3. bootstrap manifest
4. durable memory
5. capability synthesis layer
6. friction logging and self-improvement loop

### Minimum implementation sequence for a new project
1. Write planning backbone doc.
2. Create backbone roadmap project.
3. Add bootstrap manifest generator.
4. Add durable-memory generator.
5. Define refresh command.
6. Connect roadmap state to capability/model status if the project has a feature model.
7. Add friction logging only after durable memory is stable.

## Recommended Requirements Checklist for Porting

### Foundation
- There is a project-level planning standard.
- There is a roadmap or equivalent planning system.
- There is a place to store generated bootstrap artifacts.

### Context
- Route map can be parsed.
- Key backend and schema anchors can be identified.
- Standard commands are known.

### Memory
- Stable facts can be separated from temporary notes.
- Durable memory can be regenerated without manual editing.

### Governance
- Self-amending behavior is explicitly bounded.
- Product changes still require normal implementation governance.

### Improvement loop
- Repeated friction can be observed.
- There is a future path to record friction as analysis and roadmap work.

## Summary
This backbone turns agent startup context from an informal conversational habit into explicit project infrastructure.

In this repository:
- FTPH documentation defines the target platform model
- the roadmap defines execution reality
- the feature tree synthesizes documentation and roadmap state into a capability surface
- the bootstrap backbone helps agents start faster and work more consistently

That combination creates a system where planning, implementation, capability modeling, and agent operations reinforce each other instead of drifting apart.
