# Admin Roadmap Backbone — Standalone Export

A complete, portable infrastructure for AI-agent-assisted product development. This package contains the planning methodology, design architecture, generator scripts, and operational patterns developed for the YourCondoManager platform — ready to adapt to another project.

## What This System Does

Reduces repeated agent startup cost and keeps planning, documentation, and implementation aligned through six coordinated layers:

1. **Planning backbone** — 8-step plan-first workflow (intent, journey, findings, decisions, opportunities, implementation, roadmap, execution rhythm)
2. **Bootstrap snapshot** — generated manifest of routes, schema, commands, and planning context
3. **Durable memory** — stable facts separated from session-specific notes
4. **Guardrails** — bounded self-amendment (backbone updates its own artifacts, never product code)
5. **Friction logging** — repeated setup pain becomes visible backlog items
6. **Metrics** — track startup cost reduction over time

## Package Contents

```
export/admin-roadmap-backbone/
├── README.md                          ← You are here
│
├── core/                              ← Backbone methodology and governance
│   ├── agent-bootstrap-backbone-generic-template.md    ← START HERE — reusable template with fill-in workbook
│   ├── admin-roadmap-service-journey-backbone.md       ← 8-step planning standard (reference implementation)
│   ├── agent-bootstrap-backbone-spec-and-requirements-2026-03-15.md  ← Full system spec and requirements
│   ├── agent-bootstrap-self-amend-guardrails.md        ← Read/write boundaries for automation
│   └── agent-bootstrap-success-metrics.md              ← Measurement framework
│
├── design/                            ← Architecture, data model, and capability model
│   ├── roadmap-system-architecture.md                  ← ROADMAP STRUCTURE — data model, API, hierarchy, sync patterns
│   ├── ftph-v2.1.md                                    ← Feature Tree Platform Hierarchy (capability model)
│   ├── ftph-gap-analysis-2026-03-14.md                 ← Capability gap analysis
│   ├── ftph-detailed-spec-comparison-2026-03-15.md     ← Detailed spec comparison
│   ├── ftph-reseller-architecture.md                   ← Multi-tenant/reseller architecture
│   ├── multi-tenant-hoa-ach-payments-architecture.md   ← Payment system architecture
│   ├── admin-contextual-feedback-prd-2026-03-28.md     ← Example PRD (admin feature)
│   ├── mobile-optimization-platform-workstreams.md     ← Example workstream breakdown
│   └── phases-6-10.md                                  ← Strategic roadmap phases
│
├── generators/                        ← Scripts that produce bootstrap artifacts
│   ├── generate-agent-bootstrap-manifest.ts            ← Manifest generator (adapt to your stack)
│   └── generate-agent-durable-memory.ts                ← Durable memory generator (adapt to your stack)
│
├── examples/                          ← Generated artifact samples
│   ├── README.md                                       ← How to use generated artifacts
│   ├── workspace-manifest.json                         ← Example startup manifest
│   ├── durable-memory.json                             ← Example stable-facts artifact
│   └── backbone-metrics.json                           ← Example metrics snapshot
│
├── source-reference/                  ← Implementation source files (reference, not runnable)
│   ├── schema-roadmap-extract.ts                       ← Drizzle schema for all roadmap tables
│   ├── roadmap.tsx                                     ← React UI for the roadmap page
│   └── add-ftph-backlog-roadmap-project.ts             ← Example: programmatic project/workstream/task seeding
│
└── operations/                        ← Agent instructions and operational guides
    ├── AGENTS.md                                       ← Agent working rules and startup protocol
    └── operator-runbook.md                             ← Day-to-day operations reference
```

## Roadmap System Structure

The roadmap itself is a 4-tier entity hierarchy with computed progress and automatic executive sync:

```
Project → Workstream → Task → Attachment
                         └── dependencyTaskIds (same-project only, cycle-validated)
```

**Key structural patterns:**
- **Projects** have status (active/complete/archived) and can only be marked complete when all tasks are done
- **Workstreams** have explicit `orderIndex` for sequencing within a project (phases, feature areas, etc.)
- **Tasks** have status, effort, priority, target dates, and typed dependencies with circular-reference prevention
- **Progress** is computed at query time from task status counts — never stored, never stale
- **Executive updates** auto-sync when tasks or projects complete — no manual reporting needed
- **Analysis tables** (versions + runs) record friction logging, closeout snapshots, and metrics generation

See `design/roadmap-system-architecture.md` for the complete data model, API routes, cascading behavior, and sync patterns. See `source-reference/` for the actual schema, UI, and seeding script implementations.

## Quickstart: Adapting to a New Project

### Step 1 — Read the generic template
Start with `core/agent-bootstrap-backbone-generic-template.md`. It contains:
- Complete system specification
- All interdependent systems with minimum capabilities
- System contracts between layers
- Porting checklist
- **Implementation Workbook** (fill-in-the-blank for your project)
- **Acceptance Checklist** (14 items to validate your port)

### Step 2 — Study the reference implementation
Read `core/admin-roadmap-service-journey-backbone.md` to see how the 8-step planning sequence works in practice. This is the living planning standard — adapt the service model examples to your domain.

### Step 3 — Review the design layer
The `design/` folder shows how architecture documents feed the capability model:
- `ftph-v2.1.md` is the capability model (Feature Tree Platform Hierarchy)
- Architecture docs (payments, reseller, etc.) show how service-journey planning produces real design specs
- These demonstrate the documentation-to-capability and planning-to-capability flows

### Step 4 — Adapt the generators
The `generators/` scripts are TypeScript and tailored to the original project's React/Express stack. You'll need to rewrite the parsing logic for your stack, but the **output schema** (shown in `examples/`) is the contract to preserve:
- Manifest: routes, pages, schema anchors, environment, commands, planning context
- Durable memory: stable facts, commands, verification paths, entry points, product decisions

### Step 5 — Set up your agent instruction surface
Use `operations/AGENTS.md` as a template. The critical section is the **Agent Startup Protocol**:
1. Load bootstrap manifest
2. Load durable memory
3. Load planning backbone (when task affects planning)
4. Load guardrails (before backbone automation)

### Step 6 — Establish guardrails
Copy `core/agent-bootstrap-self-amend-guardrails.md` and adapt the allowed/prohibited write lists to your project's boundaries.

### Step 7 — Validate with the acceptance checklist
Walk through all 14 items in the generic template's Acceptance Checklist.

## Minimum Implementation Sequence

1. Write planning backbone doc
2. Create backbone planning project in your planning system
3. Define startup protocol in agent instructions
4. Build bootstrap manifest generator
5. Build durable-memory generator
6. Define refresh command (`npm run bootstrap:agent` or equivalent)
7. Document interdependent systems, identifiers, read/write boundaries, owners
8. Connect planning state to capability model (if applicable)
9. Add friction logging after durable memory is stable
10. Add metrics and friction-to-planning sync after guardrails exist

## Key Design Principles

- **Plan first**: Service intent before screens. Journey review before implementation.
- **Durable vs transient**: Stable facts are separated from session-specific debugging notes.
- **Bounded automation**: Backbone can improve itself, never silently change product behavior.
- **Live roadmap is truth**: Update task status as chunks deliver, not just in docs.
- **Friction has thresholds**: Don't create planning work from single observations.
- **Graceful degradation**: If one system is down, the rest still work.

## Design and Architecture Coverage

This export includes the full design layer:
- **Capability model** (FTPH v2.1) — the target system structure with modules, feature sets, and functional units
- **Gap analysis** — what's delivered vs partial vs inactive
- **Service architectures** — payments, reseller/multi-tenant, contextual feedback
- **Strategic roadmap** — phases 6-10 with workstream breakdowns
- **Workstream examples** — mobile optimization showing the template in action

These demonstrate how documentation, planning, and the capability model work together — the synthesis loop that makes the backbone effective.
