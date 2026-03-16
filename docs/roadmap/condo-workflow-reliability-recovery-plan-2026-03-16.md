# Condo Workflow Reliability Recovery Plan

Date: 2026-03-16
Project: `Condo Workflow Reliability and Data Integrity Recovery`
Status: Proposed active roadmap project
Source: Exploratory testing transcripts normalized into 40 issues

## Purpose

Turn the exploratory testing observations into an execution-ready recovery project focused on the highest-friction condo-management workflows:

- authentication and workspace entry
- association context and navigation
- owner onboarding and review
- residential data integrity
- communications architecture and UX
- governance role and permission workflows
- meetings, agenda, and voting execution
- board package delivery and operator guidance
- platform architecture and WIP feature visibility

The objective is not generic polish. It is to remove the failures that currently block operators from signing in, reaching the right workspace, completing onboarding, trusting registry data, and sending standard communications cleanly.

## Service Intent

Target user:
- platform admins
- board admins
- association managers

Operating model:
- association-scoped admin workspace for daily condo operations
- users must move from sign-in to scoped work without needing workaround navigation
- residential records must remain internally consistent across units, people, owners, and occupancy

Success definition:
- authentication lands the user in the intended workspace
- onboarding submissions and approvals appear consistently across all affected registries
- owner, people, and occupancy records enforce domain rules
- communications tools reflect finance and operations workflows instead of exposing placeholder or misfiled controls
- governance, meeting, voting, and compliance workflows submit successfully with valid permissions and understandable inputs
- unfinished modules can be hidden from non-admin users until they are operationally ready

## Findings Summary

The transcripts surfaced 40 issues across condo operations, governance, communications, and platform-control workflows. The dominant patterns were:

1. Authentication and routing flow inconsistencies
2. Data synchronization failures between onboarding, owners, and people registries
3. Residential data model misalignment across units, owners, tenants, and occupancy
4. Navigation bindings that expose controls without completing the intended action
5. Governance workflows that fail on core actions such as role assignment, meeting creation, voting, and task creation
6. Platform modules that expose incomplete features without enough operator guidance or role-based visibility control

Priority distribution from the source observations:

- High: 20
- Medium: 18
- Low: 2

## Workstreams

### 1. Authentication and Workspace Entry

Goal:
Stabilize the sign-in path so users enter the correct workspace once, without duplicate flows or confusing public-shell residue.

Tasks:

| Issue ID | Task | Priority | Effort |
| --- | --- | --- | --- |
| ISS-001 | Prevent duplicate Google sign-in window launches during login. | high | medium |
| ISS-002 | Preserve intended workspace redirect after authentication instead of returning users to the landing page. | critical | medium |
| ISS-003 | Remove debug-style UI residue from the public landing page. | medium | small |
| ISS-004 | Remove or redesign the post-login `Refresh Google session` control with a clear operator purpose. | medium | small |

### 2. Association Context and Navigation

Goal:
Make the core workspace legible and navigable so association-scoped work starts in the right place and record-level actions resolve correctly.

Tasks:

| Issue ID | Task | Priority | Effort |
| --- | --- | --- | --- |
| ISS-005 | Load every association the current account can access in the association context selector. | high | medium |
| ISS-006 | Make global search resolve to matching modules and records instead of hard-routing to communications. | high | medium |
| ISS-007 | Redesign the associations overview so it shows association-level KPIs instead of owner-centric metrics. | medium | medium |
| ISS-008 | Profile and reduce association detail page load latency. | medium | medium |
| ISS-021 | Connect owner row selection to owner detail navigation. | high | small |

### 3. Owner Onboarding Form and Review Workflow

Goal:
Repair the highest-frequency intake workflow so the form is understandable, the review surface works, and submission results are visible immediately.

Tasks:

| Issue ID | Task | Priority | Effort |
| --- | --- | --- | --- |
| ISS-013 | Add explicit labels and remove ambiguous prefilled values in the owner onboarding form. | high | medium |
| ISS-014 | Move second-owner fields from occupancy into the ownership section. | medium | small |
| ISS-015 | Replace the single mailing-address text field with structured address components. | medium | medium |
| ISS-016 | Remove emergency-contact collection from owner onboarding. | low | small |
| ISS-017 | Make newly submitted onboarding records appear immediately in the owner list. | high | large |
| ISS-018 | Repair onboarding review and open actions on the dashboard. | high | medium |

### 4. Residential Registry and Data Integrity

Goal:
Restore trust in the residential system of record by enforcing ownership rules and aligning owners, people, units, and occupancy around a consistent model.

Tasks:

| Issue ID | Task | Priority | Effort |
| --- | --- | --- | --- |
| ISS-019 | Synchronize approved onboarding owners into the people registry as well as the owners registry. | high | medium |
| ISS-020 | Enforce unit-level ownership percentage validation so ownership totals cannot exceed 100%. | high | medium |
| ISS-022 | Redesign the residential data model around unit-scoped ownership and occupancy relationships. | high | large |

### 5. Communications Architecture and Operator UX

Goal:
Untangle communications from finance leakage, provide reusable templates, and reduce operator confusion on the communications surface.

Tasks:

| Issue ID | Task | Priority | Effort |
| --- | --- | --- | --- |
| ISS-009 | Move payment method registry ownership from communications to the finance module. | medium | medium |
| ISS-010 | Add standard communications templates, starting with payment instructions and common notices. | high | medium |
| ISS-011 | Add association letterhead and shared header metadata to outbound communications. | medium | small |
| ISS-012 | Rework communications layout and control grouping to reduce workflow clutter. | medium | large |

### 6. Governance Role and Permission Reliability

Goal:
Make governance access and role assignment operationally reliable so admins can assign board roles, trust permission checks, and manage governance workflows from the right record context.

Tasks:

| Issue ID | Task | Priority | Effort |
| --- | --- | --- | --- |
| ISS-023 | Fix board role assignment date validation so valid inputs do not trigger 400 errors. | high | medium |
| ISS-024 | Allow board role assignment from owner or people management instead of isolating it in governance. | medium | medium |
| ISS-035 | Repair governance permission evaluation so assigned admins are recognized correctly. | high | medium |

### 7. Meetings, Agenda, Voting, and Compliance Operations

Goal:
Repair the governance execution path so meetings, agenda items, votes, and governance tasks can be created and managed without system errors or invalid governance options.

Tasks:

| Issue ID | Task | Priority | Effort |
| --- | --- | --- | --- |
| ISS-029 | Fix meeting creation errors in the scheduler workflow. | high | medium |
| ISS-030 | Consolidate and clean up meeting type selection UI. | medium | small |
| ISS-031 | Seed representative meeting data so the management interface is understandable in test and demo environments. | medium | small |
| ISS-032 | Add clear labels and rules for agenda item numeric parameters. | medium | small |
| ISS-033 | Repair vote submission and tally acceptance logic. | high | medium |
| ISS-034 | Remove anonymous voting from governance voting flows. | medium | small |
| ISS-036 | Fix governance task creation errors. | high | medium |
| ISS-037 | Investigate why regulatory library sync returns zero extracted compliance rules. | medium | medium |
| ISS-038 | Add contextual examples and field descriptions to governance task creation. | medium | small |

### 8. Board Package Delivery and Operator Guidance

Goal:
Make board package workflows understandable and trustworthy by clarifying controls, documenting usage, validating delivery, and simplifying over-coupled generation steps.

Tasks:

| Issue ID | Task | Priority | Effort |
| --- | --- | --- | --- |
| ISS-025 | Explain the `Run scheduled sweep` control with contextual help or tooltips. | medium | small |
| ISS-026 | Add usage guidance and how-to support for board package workflows. | high | medium |
| ISS-027 | Investigate board package delivery status versus actual email receipt. | high | medium |
| ISS-028 | Evaluate simplification of board package generation dependencies and workflow design. | medium | medium |

### 9. Platform Architecture and Feature Exposure Control

Goal:
Reduce module fragmentation across the platform and stop unfinished features from appearing to users who should only see production-ready workflows.

Tasks:

| Issue ID | Task | Priority | Effort |
| --- | --- | --- | --- |
| ISS-039 | Review and align inter-module data relationships across governance, owners, meetings, and compliance features. | high | large |
| ISS-040 | Add WIP feature visibility controls so incomplete modules can be hidden from non-admin users. | high | medium |

## Sequencing

Recommended execution order:

1. Authentication and Workspace Entry
2. Owner Onboarding Form and Review Workflow
3. Residential Registry and Data Integrity
4. Governance Role and Permission Reliability
5. Meetings, Agenda, Voting, and Compliance Operations
6. Association Context and Navigation
7. Board Package Delivery and Operator Guidance
8. Communications Architecture and Operator UX
9. Platform Architecture and Feature Exposure Control

Reasoning:

- Authentication and redirect failures block entry into all downstream workflows.
- Onboarding and registry sync issues create immediate operating and data-trust damage.
- Residential model and validation decisions should be made before broader people/owner workflow expansion.
- Governance role, permission, meeting, voting, and compliance failures block core board-management operations.
- Navigation, board package, and communications fixes are important, but they depend less on foundational workflow and permission decisions.
- Platform-level architecture and feature-gating work should absorb what is learned from the workflow repairs rather than preceding them.

## Implementation Waves

The execution sequence below converts the project into four timeline waves with exact target windows.

### Wave 1: Core Workflow Recovery

Window:
- March 16, 2026 to March 27, 2026

Focus:
- restore entry, submission, validation, permission, and core governance execution paths

Issue IDs:
- ISS-001
- ISS-002
- ISS-005
- ISS-013
- ISS-017
- ISS-018
- ISS-019
- ISS-020
- ISS-023
- ISS-029
- ISS-033
- ISS-035
- ISS-036

Immediate Sprint:
- ISS-001 Prevent duplicate Google sign-in window launches during login
- ISS-002 Preserve workspace redirect after authentication
- ISS-013 Add clear labels and remove ambiguous prefills in owner onboarding
- ISS-023 Fix board role assignment date validation
- ISS-029 Fix meeting creation failures in the scheduler
- ISS-035 Repair governance permission evaluation for assigned admins

Sprint rationale:
- these tasks are the highest-leverage blockers for basic entry and governance write actions
- they are early-wave tasks with minimal cross-dependency on unfinished downstream cleanup work
- closing them opens the path for ISS-017, ISS-018, ISS-024, ISS-033, and ISS-036

### Wave 2: Usability and Workflow Stabilization

Window:
- March 30, 2026 to April 10, 2026

Focus:
- repair adjacent workflow steps, form clarity, record navigation, and governance setup usability once the blocking paths work

Issue IDs:
- ISS-006
- ISS-008
- ISS-015
- ISS-021
- ISS-024
- ISS-025
- ISS-026
- ISS-030
- ISS-031
- ISS-032
- ISS-034
- ISS-037
- ISS-038

### Wave 3: Workflow Completion and Experience Cleanup

Window:
- April 13, 2026 to April 24, 2026

Focus:
- complete secondary workflow improvements across auth polish, associations, onboarding polish, communications setup, and board package delivery confidence

Issue IDs:
- ISS-003
- ISS-004
- ISS-007
- ISS-009
- ISS-010
- ISS-011
- ISS-014
- ISS-016
- ISS-027

### Wave 4: Structural Completion and Control Layer

Window:
- April 27, 2026 to May 8, 2026

Focus:
- absorb learning from repaired workflows into architecture, feature gating, deeper communications UX, and longer-horizon model simplification

Issue IDs:
- ISS-012
- ISS-022
- ISS-028
- ISS-039
- ISS-040

## Key Dependencies

The roadmap should enforce at least these sequence relationships:

- ISS-002 depends on ISS-001
- ISS-017 depends on ISS-013
- ISS-018 depends on ISS-017
- ISS-019 depends on ISS-017
- ISS-033 depends on ISS-029
- ISS-036 depends on ISS-035
- ISS-015 depends on ISS-013
- ISS-021 depends on ISS-019
- ISS-024 depends on ISS-023
- ISS-030 depends on ISS-029
- ISS-032 depends on ISS-029
- ISS-034 depends on ISS-033
- ISS-037 depends on ISS-036
- ISS-038 depends on ISS-036
- ISS-006 depends on ISS-005
- ISS-008 depends on ISS-005
- ISS-003 depends on ISS-002
- ISS-004 depends on ISS-002
- ISS-007 depends on ISS-005
- ISS-010 depends on ISS-009
- ISS-011 depends on ISS-010
- ISS-014 depends on ISS-013
- ISS-016 depends on ISS-013
- ISS-012 depends on ISS-010 and ISS-011
- ISS-022 depends on ISS-019 and ISS-020
- ISS-028 depends on ISS-027
- ISS-039 depends on ISS-024, ISS-022, and ISS-028
- ISS-040 depends on ISS-039

## Verification Expectations

Per workstream, verification should be explicit:

- Authentication: sign in once, confirm a single auth window, and confirm redirect lands on the intended workspace route.
- Association context: verify multi-association visibility and route resolution for search and row-click actions.
- Onboarding: submit, review, approve, and confirm records appear in every expected list without refresh ambiguity.
- Data integrity: attempt invalid ownership allocations and confirm the system blocks them with clear messaging.
- Governance: assign board roles, create meetings, create governance tasks, cast votes, and confirm permission checks succeed for the intended admin role.
- Board packages: generate, send, inspect delivery logs, and confirm status matches actual receipt behavior.
- Communications: verify payment-method placement, template availability, outbound branding, and layout clarity in the live workflow.
- Platform controls: confirm incomplete modules can be hidden by role or feature state without breaking admin access needed for implementation.

## Backlog Capture Notes

This project intentionally mirrors the exploratory testing issue catalog one-to-one so no finding is lost during triage.

Implementation should keep the issue IDs visible in task descriptions, PRs, and verification notes until the recovery project is closed.
