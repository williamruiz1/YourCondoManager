# Board Self-Service Workspace Review and Implementation Plan - 2026-03-15

## Purpose
Capture the full findings, product direction, and implementation structure for the board self-service workspace from a user-service perspective.

## Service Intent
The product should serve board members as lightweight operators, especially for associations that are self-managed or highly board-involved.

Operating model:
- board self-service workspace
- direct write authority for in-scope association operations
- strong activity records and state tracking
- association-scoped access only

This is not a read-only oversight experience. It is an operational workspace for board members who need to help run the association.

## Target User Modes

### 1. Self-Managed Board
- Board members operate many day-to-day workflows directly.
- They need direct write access, visible states, and reliable history.

### 2. Highly Involved Board with External Support
- Board members still want to inspect, adjust, and act without waiting on a manager for every step.
- They need clear visibility into activity, responsibilities, and current state.

### 3. Low-Involvement Board
- They may use only a subset of the workspace.
- The same model should still work, but the product should not assume they are purely passive.

## Current Journey Review

### What now works
- Board members can be invited into an association-scoped workspace.
- Owner-board members can resolve to combined access under one identity.
- The workspace now exposes association overview, registry edits, documents, notices, maintenance context, and board-facing financial/governance snapshots.
- Board access downgrades or expires when service ends.

### Current journey strengths
- One identity instead of fragmented owner/admin/board accounts
- Association-scoped boundary is explicit in the access model
- Direct write is possible for important registry records
- Lifecycle and audit foundations now exist

## Findings and Opportunities

### Finding 1: The workspace still leans data-first more than action-first
User consequence:
- Board members can inspect more than before, but they still need to infer what requires attention.

Opportunity:
- Convert the landing experience into a board operations queue:
  - overdue tasks
  - upcoming meetings requiring preparation
  - unresolved maintenance issues
  - delinquency risk
  - recently changed records
  - documents or notices awaiting action

### Finding 2: Activity history exists technically but is not yet surfaced as an operating feed
User consequence:
- Self-managing boards cannot easily see the living record of what changed, who changed it, and what state moved.

Opportunity:
- Add an association activity feed for board members with:
  - actor
  - action
  - object
  - before/after summary where relevant
  - timestamp
  - association scope

### Finding 3: Object state is still inconsistent across the user journey
User consequence:
- Board members may not understand whether an item is draft, active, blocked, ready, overdue, published, or closed.

Opportunity:
- Make workflow state explicit and visible across:
  - board access
  - governance tasks
  - meetings
  - notices
  - maintenance
  - packages / approvals / distribution

### Finding 4: Direct write exists, but board-specific operating loops are still too thin
User consequence:
- The workspace supports editing records, but not yet enough board-native operational actions.

Opportunity:
- Add direct board workflows for:
  - governance task management
  - meeting creation and update
  - notice drafting/review/sending
  - document publishing and visibility management
  - maintenance triage
  - financial review actions

### Finding 5: The workspace still needs more trust signals for elevated access
User consequence:
- Even with improved lifecycle logic, the user journey should communicate status, access basis, and important state changes clearly.

Opportunity:
- Show board access status, role, effective permissions, service period, and meaningful state changes in the workspace.

## Product Decisions

### Confirmed Decisions
- Operating model: lightweight operator workspace
- Authority model: direct write for in-scope association operations
- Role shape: board self-service workspace
- Owner overlap: one identity with combined owner-plus-board access
- Scope boundary: association-scoped only
- History requirement: activity records and states are essential

### Resulting Product Standard
Every board-facing workflow should answer:
- what is the current state?
- who changed it?
- when did it change?
- what can the board do next?

## Implementation Structure

### Workstream 1: Service Intent and Journey Backbone
Goal:
- Formalize this planning pattern so future service-model changes follow the same rhythm.

Outputs:
- reusable planning backbone
- repeatable roadmap structure
- definition of ready / done for service-oriented work

### Workstream 2: Board Workspace Action-First Landing
Goal:
- Replace passive overview with a practical board operating queue.

Target deliverables:
- attention-needed widgets
- due/overdue sections
- “next best action” framing
- recent critical changes

### Workstream 3: Activity Feed and Audit Visibility
Goal:
- Surface the living association record for board operators.

Target deliverables:
- board-visible association activity feed
- change summaries
- actor and timestamp visibility
- filtering by workflow area

### Workstream 4: Workflow State System
Goal:
- Standardize visible state across board-operated modules.

Target deliverables:
- consistent status badges
- state transition rules
- blocked / overdue / draft / published indicators
- state-aware views and filters

### Workstream 5: Core Board Operating Loops
Goal:
- Let board members execute the highest-value recurring tasks directly.

Target deliverables:
- governance task management
- meeting management
- communications workflow
- maintenance triage support
- document visibility and publishing actions

### Workstream 6: Trust and Access Communication
Goal:
- Make elevated board access understandable and safe from the user’s perspective.

Target deliverables:
- visible access state
- service-period clarity
- invite / active / expired / revoked messaging
- clear scope messaging inside the workspace

### Workstream 7: Verification and Repeatable Rollout
Goal:
- Make this a reusable operating rhythm, not a one-off project.

Target deliverables:
- verification scripts
- rollout checklist
- roadmap closeout rules
- reusable “review first, implement next” process for future projects

## Recommended Delivery Chunks

### Chunk A
- Create planning backbone
- Create board workspace implementation-plan project
- Align roadmap structure

### Chunk B
- Add action-first landing / attention queue
- Add recent activity feed

### Chunk C
- Add explicit state handling across board-facing surfaces
- Add stronger status presentation in the workspace

### Chunk D
- Add board-manageable governance tasks and meetings

### Chunk E
- Add communications and document-publishing loops

### Chunk F
- Add final verification, rollout guidance, and operational closure

## Success Criteria
- A self-managing board can log in and understand what needs attention immediately.
- A board member can act directly on core association workflows without becoming a platform admin.
- Activity history and state changes make the workspace trustworthy as an operating system of record.
- Future service-oriented work can follow the same roadmap-planning backbone.
