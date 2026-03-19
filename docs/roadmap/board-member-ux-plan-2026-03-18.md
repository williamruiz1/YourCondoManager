# Board Member UX Plan - 2026-03-18

## Purpose
Create a dedicated board-member experience for users whose only operating interest is the single association they serve.

This plan treats board members as governance and oversight users, not platform admins and not day-to-day operators by default.

## Service Intent

### Target User
- active board member for one association
- sometimes also an owner in that same association
- focused on decisions, meeting readiness, financial oversight, compliance, and trust

### Operating Model
- association-scoped board workspace
- oversight-first and decision-first
- review, approve, acknowledge, comment, and request follow-up more often than create or administer
- one signed-in identity when the same person is both owner and board member

### Authority Model
- board members can review, comment, acknowledge, approve, and vote in board workflows
- board-role-specific powers can change emphasis, but board members should not become platform admins
- platform-global controls, portfolio views, user administration, and unrelated association records remain out of scope

### Risk Posture
- show only what supports board oversight for the invited association
- keep approval, acknowledgment, and decision actions auditable
- avoid leaking operator-heavy CRUD and global administration surfaces

### Success Definition
- a board member can sign in and immediately understand:
  - what needs board action
  - what changed since the last meeting
  - which financial or compliance issues need attention
  - what is due next for the association they serve

## Journey Review Direction
Review the current board-access and owner-plus-board experience through an oversight lens:
- entry point into the board workspace
- first-use understanding of association scope and board role
- recurring review loop before meetings and deadlines
- decision-taking flow with supporting context
- trust moments around access, term status, and audit trail
- confusion points where the product still feels like an admin console or data dump

## Current-State Journey Review

### Entry and Activation
- board-member access currently resolves through the owner portal identity and adds a `Board Workspace` tab when `hasBoardAccess` is true
- owner-plus-board users stay under one signed-in identity, which is correct for the intended service model
- the active association is visible in the owner portal shell, but the overall shell still behaves like an owner portal with an extra board tab rather than a dedicated board workspace

### First-Use Experience
- the board tab opens into summary cards, workflow-state badges, and broad operating widgets
- the current screen communicates access state and some term information, which is useful trust scaffolding
- it does not immediately answer the most important board questions:
  - what needs a board decision now
  - what changed since the last meeting
  - what is at risk before the next deadline

### Recurring-Use Experience
- the current board surface includes financial, governance, maintenance, communications, and invoice actions in one long page
- this creates breadth, but it does not create a clear board operating loop
- the page reads more like a mixed admin/operator workspace than a meeting-centered governance surface

### Trust and Scope Moments
- the effective role, access state, and board term are visible, which helps explain why the user has elevated access
- the association boundary is technically enforced in the access model, but the UX does not yet make the one-association board scope feel like the organizing principle of the experience

### Decision-Taking Flow
- there is a `Needs Attention` queue, but it is still generic and lightweight
- the current experience does not yet provide a proper decision pattern with recommendation, supporting evidence, due date, owner, and approval or acknowledgment action

## Findings

### Finding 1: The current board experience is still an owner-portal extension, not a dedicated board workspace
User consequence:
- board members enter a shell optimized for owner self-service and then switch into a board tab instead of landing in a board-first environment

Why it matters:
- this weakens the sense that the product is serving a governance role with one-association focus and explicit board purpose

### Finding 2: The board page is too broad and operator-heavy for an oversight-first user
User consequence:
- board members are asked to parse a long page containing metrics, workflow states, maintenance triage, notice composition, and invoice actions instead of seeing a concise queue of decisions and risks

Why it matters:
- a board member usually wants framing, prioritization, and readiness, not a dense operating console

### Finding 3: Meeting readiness and board package review are not the center of the journey
User consequence:
- the user is not led into agenda review, minutes, board package, resolutions, or upcoming meeting preparation as the main recurring loop

Why it matters:
- for most boards, meetings are the primary governance operating rhythm

### Finding 4: Financial and compliance information is present, but not exception-framed
User consequence:
- board members see counts and totals, but they are not yet guided toward variance, delinquency, reserve exposure, looming deadlines, or unusual items that actually need board attention

Why it matters:
- boards need summary-plus-exception presentation, not raw operational volume

### Finding 5: Trust signals exist, but decision auditability is still too thin in the UX
User consequence:
- users can see that access is active, but they cannot yet easily follow who recommended an action, when a decision changed state, or what acknowledgment and approval history exists

Why it matters:
- governance users need confidence that the workspace is a trustworthy system of record for oversight and approvals

## Findings To Capture
- where the current board experience is still module-first instead of action-first
- where board users see raw data without a clear recommended next step
- where meeting preparation and board packages are not treated as the center of the experience
- where financial and compliance information lacks exception framing
- where trust, scope, and access status are not obvious enough in the UI

## Product Decisions
- board member UX is a distinct association-scoped workspace, not a reduced admin shell
- the homepage should lead with decisions, risks, and deadlines, not passive registry summaries
- meetings and board packages are core navigation, not secondary references
- financial and compliance views should default to summary plus exceptions, with drill-down on demand
- owner-plus-board identity stays unified under one login, but the board workspace remains association-scoped

### Role Emphasis
- president view should emphasize decisions, escalations, and meeting readiness
- treasurer view should emphasize cash, reserves, delinquency, variance, and unusual transactions
- secretary view should emphasize agenda, minutes, resolutions, compliance deadlines, and acknowledgments
- director-at-large view should emphasize board package, current decisions, recent changes, and open risks

These differences should change emphasis and defaults, not create entirely separate products.

## Recommended Navigation
- Home
- Meetings
- Board Package
- Decisions
- Financials
- Compliance
- Messages

## Workstream Structure

### 1. Service Intent and Role Boundaries
- document the board-member service model
- define what board members can review, approve, acknowledge, request, and escalate
- define role emphasis for president, treasurer, secretary, and director-at-large views

### 2. Journey Review and Findings Capture
- review the live current-state journey for invited board members and owner-board members
- capture the major service gaps from a board-oversight perspective

### 3. Product Decisions and Scope Boundaries
- lock the navigation, association scope, and visibility rules
- define the boundary between board oversight UX and internal admin/operator UX

### 4. Board Home and Decision Workspace
- design the board home around board actions, meeting readiness, and recent meaningful changes
- define the decision detail pattern with recommendation, supporting evidence, due date, and auditability

### 5. Meetings, Board Package, and Messaging
- make meeting prep and board package access the center of board operations
- define board-facing messaging and acknowledgment loops that belong inside this experience

### 6. Financial, Compliance, and Risk Oversight
- surface financial health, delinquencies, reserve signals, and exceptions in a board-appropriate way
- surface compliance deadlines, policy exceptions, and unresolved risks with action framing

### 7. Trust, Auditability, Verification, and Rollout
- make board scope, term status, and action history explicit in the workspace
- verify association boundaries, role visibility, and core board operating loops before closure

## Recommended Delivery Sequence
1. Confirm service model and scope boundaries in the roadmap.
2. Review the current board journey and record findings.
3. Lock product decisions before UI implementation.
4. Build the board home and decision workspace.
5. Build meetings, board package, and messaging layers.
6. Add financial, compliance, and trust signals.
7. Verify role boundaries and close the rollout honestly.
