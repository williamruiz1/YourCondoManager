# FTPH Platform Gap Analysis - 2026-03-14

## Purpose

Compare the FTPH platform documentation against what is already published and usable in the current product, then define the next development phase in the same project/workstream/task structure used by the Admin roadmap.

## Evidence Base

- FTPH scope source: `docs/roadmap/ftph-v2.1.md`
- Future-phase source: `docs/roadmap/phases-6-10.md`
- Published workspace routes: `client/src/App.tsx`
- Published admin navigation: `client/src/components/app-sidebar.tsx`
- Current implementation evidence: `server/routes.ts`, `server/storage.ts`, `shared/schema.ts`
- Current roadmap state: live database roadmap projects as of 2026-03-14

## Current Published State

The platform already exposes a broad production workspace with published routes for:

- Registry and core admin: associations, units, persons, owners, occupancy, board, documents
- Financial operations: fee schedules, assessments, late fees, financial setup, invoices, utilities, owner ledger, budgets, payments
- Governance: meetings and compliance
- Operations: communications and AI ingestion
- Platform: platform controls, admin roadmap, executive reporting, owner portal

The current Admin roadmap state indicates the original FTPH phases 1-5 are complete or archived, with additional completed gap-closure work for budgets, governance depth, bylaw intelligence, owner portal tenancy, communications onboarding, and AI ingestion rebuild. Active roadmap work is concentrated in platform hardening, ingestion trust, follow-up cleanup, and Google OAuth cutover.

## Capability Status vs FTPH

### 1. Unit, Owner, and Occupancy Registry

Status: Delivered

Evidence:
- Published pages for units, persons, owners, and occupancy
- Completed Phase 1 roadmap history
- Supporting schemas and CRUD routes are present

Assessment:
- This module is functionally present and should be treated as current-state baseline, not next-phase scope.

### 2. Governance and Board Administration

Status: Delivered

Evidence:
- Published board, meetings, and compliance views
- Completed Phase 3 plus governance gap-closure work
- Supporting entities for meetings, agenda items, notes, resolutions, votes, and annual tasks are present

Assessment:
- Core governance operations are already in-market and should only receive incremental refinement.

### 3. Financial Operations and Fee Management

Status: Partially delivered

Delivered now:
- HOA fee schedules
- Special assessments
- Late-fee rules
- Owner ledger
- Vendor invoice tracking
- Utility payments
- Budget planning
- Payment-method instruction management
- Gateway connection records
- Owner payment link generation
- Webhook-driven payment posting into the ledger

Gaps still open:
- No real hosted payment checkout or ACH/card collection flow
- No owner-managed saved payment methods in the portal
- No autopay enrollment or recurring charge orchestration
- No delinquency workflow, collections handoff, or aging dashboard
- No bank reconciliation workflow
- No board-ready financial reporting suite with export
- Existing payment gateway validation is structural, not a live provider handshake

Assessment:
- This is the largest remaining gap inside an otherwise broad live platform.
- It is the right next-phase focus because the system can calculate and track money owed, but still does not complete the collection and close-control loop end to end.

### 4. Document and Record Management

Status: Delivered with active hardening

Delivered now:
- Document repository
- Tagging and versioning support
- AI ingestion workflows
- Metadata extraction and record suggestion
- Bylaw intelligence foundation

Open gaps:
- Platform gap-analysis project still tracks auth, document-delivery, and authorization hardening
- AI ingestion trust work is still active

Assessment:
- This area is already beyond MVP capability and should remain on the hardening track, not become the next primary roadmap phase.

### 5. Meetings, Notes, and Decision Records

Status: Delivered

Assessment:
- Covered by the governance delivery already published.

### 6. Operational Tasks, Compliance, and Calendar

Status: Delivered for governance operations, partial for property operations

Delivered now:
- Annual compliance tasks
- Calendar and recurring governance workflows
- Dashboard visibility for governance deadlines

Partial only:
- Maintenance requests exist
- Escalation fields exist
- Portal submission exists

Missing:
- Work-order management
- Preventive maintenance schedules
- Inspection records
- Property operations lifecycle views

Assessment:
- This is a valid later-phase candidate, but the payment collection gap is still more immediate.

### 7. Communications and Notice System

Status: Delivered with delivery-integrity follow-up

Delivered now:
- Communications workspace
- Notice templates
- Payment instructions
- Resident communications and onboarding support
- Email provider foundation

Open gaps:
- Gap-analysis project still flags simulated delivery vs fully trusted production delivery

Assessment:
- Broadly usable now; remaining work is operational integrity, not foundational scope.

### 8. Platform Services, Permissions, and Audit

Status: Delivered with hardening still active

Delivered now:
- Admin users and scoped roles
- Audit logging
- Multi-association architecture
- Subscription and SaaS controls
- Admin roadmap and executive reporting

Open gaps:
- Auth/session hardening
- Some authorization tightening
- OAuth cutover still active

Assessment:
- Continue as a parallel platform-hardening stream, but not the primary product phase.

## What Is Left

### Fully delivered or effectively market-ready

- Registry and ownership model
- Governance, meetings, compliance, resolutions, votes
- Document repository and document intelligence foundation
- Communications, notices, and onboarding foundation
- Owner portal baseline
- Multi-association and admin platform controls

### Delivered but not yet complete enough to call end-state

- Payment collection
- Payment operations controls
- AI/document trust and access-control hardening
- Auth and session security

### Material feature families still absent from FTPH target state

- Autopay and recurring collections
- Delinquency and collections workflow
- Bank reconciliation
- Financial report pack and exports
- Vendor registry
- Work orders
- Preventive maintenance
- Inspection records
- Advanced analytics and board package automation
- API and integration platform beyond current point solutions

## Recommended Next Phase

### Recommendation

Use the next primary roadmap phase to finish **Payment Processing and Financial Automation** before expanding further into vendor and property operations.

### Why this phase next

- It closes the highest-value gap in the current live platform.
- Core financial setup already exists, so the phase builds on shipped workflows rather than opening a brand-new domain.
- It improves real-world utility immediately for admins, boards, and owners.
- Property-operations work in Phase 7 will benefit from stronger payment, reconciliation, and reporting controls.

## Proposed New Admin Roadmap Project

### Project title

`FTPH Next Phase - Payment Processing and Financial Automation`

### Objective

Convert the current payment foundation into a production-ready financial operations layer that can collect owner payments, automate recurring collections, manage delinquency, reconcile bank activity, and generate board-ready reporting.

### Exit criteria

- Owners can pay balances through a real payment flow
- Admins can trace every payment from gateway event to ledger entry
- Autopay and failed-payment handling are operational
- Delinquency workflows and notice triggers are configurable
- Reconciliation can be completed for a closed period
- Finance reports can be exported for board use

## Workstreams for the New Project

### 1. Payment Gateway Productionization

Outcome:
- Replace the current validation-and-test harness with a real transaction path.

Core tasks:
- Implement live provider credential verification and secure secret handling
- Create hosted payment session or checkout flow for ACH and card
- Add signed webhook verification and stronger payment event lifecycle states
- Build admin payment activity visibility tied to ledger outcomes

### 2. Owner Payment Experience

Outcome:
- Turn owner payments from an admin-generated token flow into a usable owner-facing experience.

Core tasks:
- Add portal payment screen with balance summary and payable options
- Add saved payment methods and owner-managed defaults
- Support full and partial payment rules with receipts
- Link reminders and due notices to payment actions

### 3. Autopay and Delinquency Automation

Outcome:
- Move from one-off payment collection to recurring and policy-driven collection operations.

Core tasks:
- Add autopay enrollment and schedule management
- Build recurring charge runner with retry logic
- Add delinquency thresholds, notice sequencing, and escalation tracking
- Create collections handoff and aging dashboard views

### 4. Reconciliation and Financial Reporting

Outcome:
- Close the operational finance loop after payment posting.

Core tasks:
- Add bank statement import and normalization
- Add auto-match and review queue workflows
- Add reconciliation period closure controls
- Add AR aging, income/expense, reserve, and exportable board reports

### 5. Launch Controls and Finance Readiness

Outcome:
- Make the phase shippable, supportable, and auditable.

Core tasks:
- Add audit coverage, alerts, and finance-grade error handling
- Add feature flags and staged rollout by association
- Add acceptance checks across payment success, failure, retry, and reconciliation scenarios
- Prepare operator runbooks and release metrics

## Recommended Sequencing

### Phase A: Transaction Core

- Workstream 1
- Workstream 2

### Phase B: Automation and Control

- Workstream 3
- Workstream 4

### Phase C: Launch and Stabilization

- Workstream 5

## What Should Come After This

Once payment processing and finance controls are in place, the next major phase should move into **Vendor, Maintenance, and Property Operations**, using the existing maintenance-request foundation as the starting point for vendor registry, work orders, preventive maintenance, and inspection records.
