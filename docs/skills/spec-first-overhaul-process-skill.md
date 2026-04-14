# Spec-First Platform Overhaul — Process Skill
**Version:** 1.0
**Scope:** YCM Platform Overhaul initiative
**Owner:** YCM Command Center
**Last updated:** 2026-04-14

---

## Purpose

This skill defines the process, conventions, artifact paths, and agent protocols for the YCM Spec-First Platform Overhaul. Any agent operating on this initiative — whether generating documentation, producing PPM task cards, or executing build work — must read this file first and treat it as the authoritative process reference.

This document does not define product decisions. Product decisions live in the decision docs under `docs/projects/platform-overhaul/decisions/`. When this skill and a decision doc conflict, the decision doc wins for the specific module it governs.

---

## Core Principle

No code changes before the spec is locked. The process moves in one direction:

```
Audit → Decision Spec → SPEC LOCKED → PPM Task Card → Handoff Doc → Build → Validate
```

An agent that skips a step, infers a product decision not documented in a locked spec, or begins implementation before the governing spec reaches SPEC LOCKED status is out of compliance with this process. Surface the ambiguity. Do not infer.

---

## Layer Map

The overhaul is organized into six layers. Each layer must reach SPEC LOCKED before the layer below it begins implementation.

| Layer | Name | Description |
|---|---|---|
| **Layer 0** | Foundational Decisions | Cross-cutting decisions that govern all layers below. Dashboard resolution, persona map, navigation model. |
| **Layer 1** | IA Taxonomy Cleanup | Section taxonomy corrections, naming and classification fixes. Low-risk, largely rename/reclassify work. |
| **Layer 2** | Role & Permission Model | Role definitions, persona-to-role mapping, permission boundary corrections. |
| **Layer 3** | Navigation Restructure | Sidebar, breadcrumb, route restructure based on locked Layer 0 and Layer 2 decisions. |
| **Layer 4** | Feature Gaps | Net-new features required for MVP readiness identified during audit. |
| **Layer 5** | Polish & Hardening | UX polish, empty states, error states, mobile fixes, performance. |

---

## Module Registry

### Layer 0 — Foundational Decisions

| ID | Name | Status |
|---|---|---|
| 0.1 | Dashboard Resolution | SPEC LOCKED |
| 0.2 | Persona Map | QUEUED |
| 0.3 | Navigation Model | QUEUED |

### Layer 1 — IA Taxonomy Cleanup

| ID | Name | Status |
|---|---|---|
| 1.1 | Zone taxonomy corrections | QUEUED |
| 1.2 | Section hub reclassification | QUEUED |
| 1.3 | Breadcrumb label audit | QUEUED |
| 1.4 | Page title consistency | QUEUED |

### Layer 2 — Role & Permission Model

| ID | Name | Status |
|---|---|---|
| 2.1 | Persona definitions | QUEUED |
| 2.2 | Role-to-persona mapping | QUEUED |
| 2.3 | Permission boundary corrections | QUEUED |
| 2.4 | Role-gating audit | QUEUED |

### Layer 3 — Navigation Restructure

| ID | Name | Status |
|---|---|---|
| 3.1 | Sidebar redesign | QUEUED |
| 3.2 | Route restructure | QUEUED |
| 3.3 | Role-gating corrections | QUEUED |
| 3.4 | Breadcrumb implementation | QUEUED |

### Layer 4 — Feature Gaps

| ID | Name | Status |
|---|---|---|
| 4.1 | Cross-association alert engine | QUEUED |
| 4.2 | Owner portal gaps | QUEUED |
| 4.3 | Recurring assessment rules engine | QUEUED |
| 4.4 | Signup and checkout flow | QUEUED |

### Layer 5 — Polish & Hardening

| ID | Name | Status |
|---|---|---|
| 5.1 | Empty states | QUEUED |
| 5.2 | Error states | QUEUED |
| 5.3 | Mobile audit | QUEUED |
| 5.4 | Performance audit | QUEUED |

---

## Module Status Definitions

| Status | Meaning |
|---|---|
| `QUEUED` | Not yet started. No spec work has begun. |
| `IN SPEC` | Spec is being drafted. No build work may begin. |
| `SPEC LOCKED` | Decision doc is finalized and approved. PPM task card may now be created. Build may not begin until the task card and handoff doc exist. |
| `IN BUILD` | Computer is actively implementing. |
| `IN REVIEW` | Build complete. Under human or agent review. |
| `COMPLETE` | Implemented, reviewed, and merged. |
| `BLOCKED` | Cannot proceed. Blocking issue documented in the module's decision doc. |

---

## Canonical Paths

```
docs/
  skills/
    spec-first-overhaul-process-skill.md     ← this file
  projects/
    platform-overhaul/
      00-index.md                            ← master module index
      decisions/
        0.1-dashboard-resolution.md
        0.2-persona-map.md
        0.3-navigation-model.md
        1.x-[module-name].md
        ...
      handoffs/
        [module-id]-[module-name]-handoff.md ← Computer activation docs
      ppm/
        [module-id]-[module-name]-task.md    ← PPM task cards
```

---

## Artifact Definitions

### Decision Doc
The spec for a single module. Produced by YCM Command Center, approved by the founder. Must reach SPEC LOCKED before any downstream artifact is created. Contains: context, conflict analysis (where applicable), options considered, selected resolution, directives, open questions (resolved before locking), acceptance criteria, and a decision log.

### PPM Task Card
A structured task card derived from a locked decision doc. Produced by the Claude documentation agent. Contains: objective, layer, upstream dependencies, acceptance criteria (verbatim from the decision doc), assignee (Computer), and status. Lives in `docs/projects/platform-overhaul/ppm/`.

### Handoff Doc
A Computer activation document for a specific build chunk. Produced by YCM Command Center or the Claude documentation agent. Contains: the files to read before starting, the specific implementation directives, validation criteria, and the path where Computer writes its session summary. Lives in `docs/projects/platform-overhaul/handoffs/`.

### Master Index
A single file at `docs/projects/platform-overhaul/00-index.md` listing every module across all layers with current status. Updated whenever a module status changes.

---

## Agent Protocols

### For any agent starting work on this initiative

1. Read `AGENTS.md` at repo root
2. Read `docs/agent-bootstrap/workspace-manifest.json`
3. Read `docs/agent-bootstrap/durable-memory.json`
4. Read `docs/skills/spec-first-overhaul-process-skill.md` (this file)
5. Read `docs/projects/platform-overhaul/00-index.md` to get current module statuses
6. Read the specific decision doc for the module you are working on
7. Only then begin your assigned task

### For Computer (build execution)

- Never begin implementation without a SPEC LOCKED decision doc for the module
- Never infer a product decision not present in a locked spec — surface the ambiguity in your session handoff
- Separate pre-existing failures from failures introduced by your work
- Write a session summary to `docs/overnight/YYYY-MM-DD-[module-id]-handoff.md` before stopping
- Update `docs/projects/platform-overhaul/00-index.md` module status to `IN BUILD` when starting, `IN REVIEW` when done

### For the Claude documentation agent

- Never create PPM task cards from an unlocked spec
- Acceptance criteria in task cards must be verbatim from the decision doc — do not paraphrase
- Do not modify any source files, routes, or components — documentation only
- After pushing docs, update `00-index.md` to reflect current statuses

---

## Canonical Truth Hierarchy

When sources conflict, resolve in this order (highest wins):

1. Decision docs at `docs/projects/platform-overhaul/decisions/` (for IA/nav/UX decisions)
2. Strategy docs at `docs/strategy/` (for pricing, positioning, GTM decisions)
3. `docs/agent-bootstrap/durable-memory.json` (for persisted product memory)
4. Live source code (for current implementation state — describes what IS, not what SHOULD BE)
5. Marketing copy / landing page / pricing page content (lowest — frequently stale)

Never treat live marketing copy as canonical product strategy. If a decision doc and the live pricing page conflict, the decision doc wins.

---

## Open Questions Registry

Open questions that span modules (not specific to one decision doc) are tracked here. Module-specific open questions live in the decision doc for that module.

*No cross-module open questions at time of v1.0 publication.*

---

## Change Log

| Date | Author | Change |
|---|---|---|
| 2026-04-14 | YCM CC | v1.0 — initial publication |
