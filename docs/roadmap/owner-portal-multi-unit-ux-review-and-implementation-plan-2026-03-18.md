# Owner Portal Multi-Unit UX Review and Implementation Plan - 2026-03-18

## Purpose
Capture the owner portal structure, current end-to-end journey, and the product changes required to make the portal valuable for owners without overwhelming them, especially when one owner has multiple units.

## Service Intent
The owner portal should serve owners as informed self-service customers, not lightweight admins.

Operating model:
- owner-first self-service workspace
- read-mostly by default with tightly scoped write actions
- action-oriented for high-frequency owner tasks
- calm, trust-building interface that does not force owners to learn association operations
- explicit support for both single-unit and multi-unit ownership

This is not an association operations console. It should help owners answer:
- What do I owe?
- What changed?
- What do I need to do next?
- Which unit does this apply to?
- How do I complete the task without contacting management?

## Target User Modes

### 1. Single-Unit Owner
- Wants a simple account view.
- Typically needs balance, notices, documents, maintenance, and contact updates.
- Has low tolerance for dense workflow language.

### 2. Multi-Unit Owner
- Thinks in terms of a small portfolio, not a single residence.
- Needs quick cross-unit visibility before drilling into one unit.
- Must understand which balance, occupants, notices, and requests belong to which unit.

### 3. Owner-Board Member
- Needs owner self-service and board workspace under one identity.
- Still needs the owner experience to remain calm and distinct from board operations.

## Current Journey Review

### Entry and Authentication
- Email OTP sign-in resolves to a single `portalAccessId`.
- If multiple accesses exist, the portal returns a picker.
- After login, the page persists one selected `portalAccessId` in local storage.

Evidence:
- [server/routes.ts](/home/runner/workspace/server/routes.ts#L7208)
- [client/src/pages/owner-portal.tsx](/home/runner/workspace/client/src/pages/owner-portal.tsx#L155)

### Current Information Architecture
The owner portal is organized into:
- sticky top header with association and unit context
- unit switcher and association switcher in the header
- horizontal tab nav
- overview tab
- financials tab
- my unit(s) tab
- maintenance tab
- documents tab
- notices tab
- optional board workspace tab

Evidence:
- [client/src/pages/owner-portal.tsx](/home/runner/workspace/client/src/pages/owner-portal.tsx#L1471)
- [client/src/pages/owner-portal.tsx](/home/runner/workspace/client/src/pages/owner-portal.tsx#L1583)

### First-Use Experience
- Owners land on a branded overview screen with association identity and a getting-started checklist.
- The checklist is helpful in tone, but it is generic and only loosely tied to actual owner intent.
- Multi-unit owners still land in a unit-scoped session and only secondarily discover the unit list.

Evidence:
- [client/src/pages/owner-portal.tsx](/home/runner/workspace/client/src/pages/owner-portal.tsx#L1590)
- [client/src/pages/owner-portal.tsx](/home/runner/workspace/client/src/pages/owner-portal.tsx#L1649)

### Recurring-Use Experience
- Overview shows a balance summary and recent notices.
- Financials shows totals, recurring charges, payment plan, autopay, payment methods, and ledger history.
- My Units shows all owned units and occupants.
- Maintenance combines request submission and request history.
- Documents and notices are browseable but largely passive.

Evidence:
- [client/src/pages/owner-portal.tsx](/home/runner/workspace/client/src/pages/owner-portal.tsx#L1752)
- [client/src/pages/owner-portal.tsx](/home/runner/workspace/client/src/pages/owner-portal.tsx#L2894)
- [client/src/pages/owner-portal.tsx](/home/runner/workspace/client/src/pages/owner-portal.tsx#L3064)
- [client/src/pages/owner-portal.tsx](/home/runner/workspace/client/src/pages/owner-portal.tsx#L3179)

### Trust and Security Moments
- OTP sign-in is appropriately lightweight.
- Owners can see contact information on file and submit review-based updates.
- Notices can expand inline, which reduces context switching.
- The page does not consistently explain why a given item is visible for one unit versus all units.

### Failure and Confusion Points
- The session model is still centered on one selected unit even when the owner conceptually owns a portfolio.
- The overview mixes association identity with unit identity but does not clearly distinguish all-unit versus current-unit data.
- The tab structure is broad, but there is no clear “do this next” hierarchy beyond the onboarding checklist.
- “My Units” is useful as a record view, but it does not yet act like a control center for a multi-unit owner.
- Notices, documents, and maintenance updates are separated by feature type instead of by urgency and unit relevance.
- The board workspace lives inside the same top-level tab rail, which risks cognitive spillover for owner-board members.

## Findings

### Finding 1: The portal is still session-first instead of portfolio-first for multi-unit owners
Current behavior:
- The owner signs into one selected `portalAccessId`.
- Unit switching is available, but the dominant mental model remains “one active unit at a time.”

Gap against intended service:
- Multi-unit owners need a compact portfolio summary first, then unit drill-down.

User impact:
- Owners with two or more units must keep re-orienting themselves to determine which balances, notices, and workflows are current.

### Finding 2: The overview is informative, but not yet action-ranked
Current behavior:
- Overview shows association hero, onboarding checklist, balance summary, and recent notices.
- The owner still has to decide where to go next.

Gap against intended service:
- The landing area should surface the next best actions in priority order.

User impact:
- Owners are exposed to information, but not guided toward the most important task.

### Finding 3: “My Units” is a record browser, not an owner operating surface
Current behavior:
- The units tab lists units, occupants, balances, and contact information.

Gap against intended service:
- A multi-unit owner should be able to compare units, spot issues, and jump directly into unit-specific actions.

User impact:
- The owner can inspect data, but not manage the highest-frequency loops efficiently.

### Finding 4: Information is split by module instead of by owner intent
Current behavior:
- Notices, maintenance updates, documents, financial history, and contact updates live in separate areas.

Gap against intended service:
- Owners think in terms of tasks such as “pay,” “review message,” “follow maintenance,” and “check unit status.”

User impact:
- The product increases navigation cost and makes the portal feel fuller than it needs to be.

### Finding 5: Trust cues are present, but state clarity is uneven
Current behavior:
- Balances and statuses appear, but state labeling is inconsistent across notices, maintenance, payment plans, and documents.

Gap against intended service:
- Owners need plain-language states such as due, paid, under review, waiting on management, resolved, and new.

User impact:
- Users must interpret internal workflow status instead of quickly understanding what the system expects from them.

### Finding 6: The board crossover path needs stronger separation
Current behavior:
- Owner-board members see a `Board Workspace` tab in the same navigation rail.

Gap against intended service:
- Elevated association operations should feel like a deliberate mode change, not just another owner tab.

User impact:
- The owner portal risks becoming mentally heavier for the users most likely to rely on it frequently.

## Product Decisions

### Decision 1: The owner portal should optimize for owner tasks, not association exploration
Result:
- The home screen should prioritize action cards, deadlines, and exceptions over broad summaries.

### Decision 2: Multi-unit ownership should be modeled as a portfolio surface inside one association
Result:
- The owner should first see cross-unit rollups and unit-level exceptions, then drill into a unit detail view.

### Decision 3: Unit context must be explicit on every unit-scoped object
Result:
- Notices, balances, occupants, maintenance items, and payment history should always show the applicable unit.

### Decision 4: Read/write actions should remain narrow and high confidence
Result:
- Owner writes should focus on payments, maintenance requests, contact updates, and preference changes.
- Broader association editing should remain out of the owner experience.

### Decision 5: Owner-board crossover should use a mode switch, not a peer tab
Result:
- The board workspace should feel like a separate operating surface entered intentionally from the owner portal.

## Opportunity Breakdown

### Opportunity 1: Owner Action Hub
User value:
- Owners know what to do in under 10 seconds.

Operating value:
- Fewer support questions about balances, notices, and maintenance status.

Implementation implications:
- Introduce priority-ranked action cards and a concise owner agenda on the overview tab.

### Opportunity 2: Multi-Unit Portfolio Summary
User value:
- Owners can understand all units at a glance.

Operating value:
- Better self-service for investors and owners with multiple homes.

Implementation implications:
- Build all-unit totals, unit health chips, and per-unit exception flags.

### Opportunity 3: Unit Detail Workspace
User value:
- Owners can inspect one unit deeply without losing portfolio context.

Operating value:
- Reduces ambiguity around occupants, balances, and open requests.

Implementation implications:
- Turn `My Units` into a split summary/detail experience instead of a long vertical stack.

### Opportunity 4: Unified Message and Update Center
User value:
- Owners can understand recent communication without bouncing between notices and maintenance updates.

Operating value:
- Stronger engagement with important communications.

Implementation implications:
- Combine “new,” “action needed,” and “for your records” states with unit badges and type filters.

### Opportunity 5: Payment Confidence and Clarity
User value:
- Owners can quickly understand what is due, what is recurring, what was paid, and what applies to which unit.

Operating value:
- Higher payment completion and fewer billing inquiries.

Implementation implications:
- Reframe financials around current due, upcoming charges, autopay state, recent payment confirmation, and per-unit ledger views.

### Opportunity 6: Deliberate Board Mode Separation
User value:
- Owner-board members can switch responsibilities without cognitive overload.

Operating value:
- Cleaner service model and less accidental mixing of owner vs board workflows.

Implementation implications:
- Replace the peer tab with an entry point such as “Open Board Workspace.”

## Implementation Structure

### Workstream 1: Service Intent and Journey Alignment
Goal:
- Lock the owner portal to a customer-style self-service model with explicit multi-unit behavior.

### Workstream 2: Action-First Overview
Goal:
- Turn the overview into a calm owner agenda with ranked next steps.

### Workstream 3: Multi-Unit Portfolio Experience
Goal:
- Make multiple units feel intentionally supported rather than technically available.

### Workstream 4: Unit Detail and Contact Experience
Goal:
- Rebuild the unit tab around unit comparison, drill-down, and trusted contact data.

### Workstream 5: Communication, Documents, and Maintenance Simplification
Goal:
- Group owner-visible information around intent and urgency rather than module boundaries.

### Workstream 6: Payment Experience and Trust Signals
Goal:
- Make financial state legible and low-stress across one or many units.

### Workstream 7: Role Separation, Verification, and Rollout
Goal:
- Keep owner mode calm, isolate board mode, and verify the journey with multi-unit scenarios.

## Recommended Delivery Chunks

### Chunk A
- Confirm owner service model
- define multi-unit interaction rules
- capture roadmap structure

### Chunk B
- redesign overview into an action hub
- add owner agenda and urgency ranking

### Chunk C
- introduce portfolio summary and per-unit exception cards
- rebuild unit drill-down

### Chunk D
- unify notices, maintenance updates, and document surfacing
- add unit-aware message states

### Chunk E
- simplify financial presentation
- add per-unit payment confidence patterns

### Chunk F
- separate board mode entry
- verify with single-unit, multi-unit, and owner-board-member scenarios

## Success Criteria
- A single-unit owner can tell what needs action within seconds of landing.
- A multi-unit owner can see all units, all balances, and all open issues without switching context repeatedly.
- Every owner-visible item makes unit scope clear.
- The owner portal feels lighter and more useful, not more feature-dense.
- Owner-board members can move into board operations intentionally without polluting the owner experience.
