# Admin Contextual Feedback Feature PRD

Date: 2026-03-28
Status: Current-state product requirements document
Primary area: Admin platform operations, roadmap capture, UI QA, issue intake

## 1. Overview

The Admin Contextual Feedback feature gives platform admins a way to inspect the live product UI, select a specific on-screen element, capture structured context, and convert that feedback directly into a roadmap task without leaving the current page.

The feature began as a lightweight overlay install and has since evolved into a more complete operational loop:
- live DOM-aware inspection
- route-specific marker persistence
- direct roadmap task creation
- in-place editing of captured tickets
- automatic screenshot attachment capture during intake
- reuse of the existing Admin roadmap as the system of record

This PRD documents the feature as it currently functions in production code, not only as originally conceived.

## 2. Problem

Before this feature existed, platform admins had to describe product issues and improvement ideas out of band. That created several problems:
- feedback lost the exact page and UI context where the issue was found
- reproduction details depended on manual writeups
- the handoff from observation to execution was slow and inconsistent
- roadmap tracking and UI review happened in separate systems
- improvement opportunities were noticed inside the live app but captured somewhere else later

The feature solves that by letting a platform admin capture feedback at the moment of discovery, on the exact interface element involved, and immediately persist that feedback into the roadmap.

## 3. Goal

Provide a platform-admin-only capture workflow that turns UI observations into structured, actionable roadmap tasks with enough route, DOM, visual, and operator context to support triage and follow-up execution.

## 4. Non-Goals

The current feature is not intended to:
- collect feedback from board admins, managers, viewers, owners, tenants, or public users
- replace a full bug tracker with assignment, comments, SLA, release linkage, or workflow automation
- create a generalized annotation layer for all users
- provide collaborative multi-user marker sync in real time
- automatically classify, deduplicate, or prioritize tickets beyond admin-provided type and priority
- expose a full attachment management UI inside the roadmap page today

## 5. Users

Primary user:
- platform admin

Secondary beneficiaries:
- product/operator teams reviewing roadmap tickets
- engineers using the roadmap as intake for implementation
- executive reporting flows that depend on roadmap completion data

## 6. User Value

The feature should let a platform admin:
- identify a UI issue or enhancement exactly where it appears
- capture enough technical context without manual forensic work
- file the issue without breaking flow or opening another tool
- revisit captured issues visually on the same route
- edit captured feedback after submission
- jump from a marker to the roadmap system of record

## 7. Current Scope Summary

The current implementation includes:
- a floating contextual feedback activator rendered globally for authenticated platform admins
- three widget modes: inactive, inspect, markers
- desktop hover inspection and click-to-capture
- touch/pen long-press capture
- automatic route, selector, DOM path, element geometry, viewport, scroll, component-name, and text-preview capture
- optional automatic screenshot capture of the selected area
- direct task creation in a dedicated roadmap project/workstream
- local route-level marker persistence in browser storage
- marker clustering for dense areas
- marker filtering that hides tasks already marked `done`
- marker detail panel with edit and open-roadmap actions
- in-place task editing from the marker workflow
- backend storage of screenshot attachments against roadmap tasks
- backend attachment CRUD endpoints for roadmap tasks

## 8. Activation and Access Model

### 8.1 Access Rules

Only authenticated admins with role `platform-admin` can see and use the widget.

The widget is not rendered for:
- board admins
- managers
- viewers
- public users
- portal users

### 8.2 Placement

The widget is rendered globally through the app shell rather than per-page registration. That allows contextual feedback capture across both workspace and public-facing routes that a platform admin can access while authenticated.

### 8.3 Activator Behavior

The widget presents as a floating draggable control with:
- a mode toggle button
- a route marker count badge in marker mode when unresolved markers exist on the current route
- persisted position memory

Activator position is stored separately for:
- workspace routes
- public routes

## 9. Core User Experience

### 9.1 Modes

The feature cycles through three modes:

1. `inactive`
- no overlay is shown
- no live inspection occurs

2. `inspect`
- the user can hover or press on UI elements
- the currently targeted element is highlighted
- selection guidance is shown
- pressing `Escape` exits inspection

3. `markers`
- previously captured unresolved markers for the current route are shown
- markers can be opened, clustered, and edited

### 9.2 Inspect Flow

When a platform admin enters inspect mode:
- moving the mouse highlights the current inspectable element
- clicking captures the selected element
- on touch/pen devices, long-press captures the selected element
- widget-owned UI is excluded from inspection to avoid self-capture
- `body` and `html` are excluded from capture

### 9.3 Capture Composer

After selection, the widget opens a contextual side panel near the highlighted element.

The composer supports:
- title
- description
- type: `bug` or `enhancement`
- priority: `low`, `medium`, `high`, `critical`
- contextual summary block
- screenshot preview when available
- screenshot removal before submit
- keyboard shortcut submit with `Cmd/Ctrl + Enter`

### 9.4 Marker Review Mode

When in marker mode, the admin can:
- see unresolved feedback markers on the current route
- open a single marker directly
- open clustered markers from dense regions
- inspect task metadata
- open the roadmap
- reopen a ticket for editing from the marker panel

## 10. Captured Context Requirements

Each feedback capture includes structured context generated from the selected element.

Required context:
- route
- CSS selector
- DOM path
- element bounds
- scroll position
- viewport size
- capture timestamp
- admin ID
- admin email
- HTML tag name

Best-effort context:
- React component name
- text preview
- CSS class name
- screenshot image

The feature must preserve enough information to support:
- reproduction
- route re-entry
- UI localization
- engineering triage
- later roadmap editing without losing the original capture anchor

## 11. Screenshot Capture Requirements

### 11.1 Current Behavior

When an element is selected, the widget attempts a best-effort screenshot capture by:
- serializing the current document into SVG
- cropping around the selected element with padding
- limiting output size for performance
- converting the result to PNG data URL

### 11.2 Constraints

Screenshot capture is intentionally best-effort:
- failure to capture must not block feedback submission
- the screenshot can be removed before submission
- the server accepts screenshot payloads up to the configured schema limit

### 11.3 Persistence

On successful task creation, if a screenshot is present:
- the server writes an image file into uploads storage
- the server creates a roadmap task attachment record
- the response includes attachment metadata for the created screenshot

## 12. Roadmap Integration

### 12.1 Source of Truth

The existing Admin roadmap remains the source of truth for feedback tickets. The contextual feedback feature does not create a parallel ticketing system.

### 12.2 Target Project and Workstream

All newly created contextual feedback tickets are routed into a dedicated project/workstream target:

- Project: `Active Project - Admin Contextual Feedback Widget`
- Workstream: `Roadmap Persistence, Attachments, and Editable Ticket Flow`

If the target project or workstream does not exist, the backend auto-creates it.

### 12.3 Task Shape

Each captured feedback item becomes a roadmap task with:
- prefixed title identifying bug vs enhancement
- structured description containing context metadata
- admin-selected priority
- initial status `todo`

### 12.4 Editing

Captured tickets can be edited from the widget. Editing updates the existing roadmap task rather than creating a duplicate.

Editable fields in the current flow:
- title
- description
- priority
- type reflected through the task title prefix
- live recaptured context based on the currently selected marker snapshot

### 12.5 Completion Interaction

Markers are hidden in marker mode when the associated roadmap task status is `done`.

This creates a lightweight closure loop:
- capture feedback on route
- track it in roadmap
- complete task in roadmap
- remove marker from the route-level unresolved marker view

## 13. Local Marker Persistence

### 13.1 Purpose

The widget stores marker metadata client-side so the admin can continue to see route-specific feedback anchors without requiring a dedicated annotations table.

### 13.2 Storage

Marker data is currently persisted in browser local storage.

Stored marker data includes:
- route
- selector
- DOM path
- bounds
- admin capture metadata
- task ID and task title
- type and priority

### 13.3 Limits

The client persists only a bounded recent set of markers.

### 13.4 Current Behavior Boundary

Markers are not currently rehydrated from a server-side annotations model. They depend on local browser storage and active roadmap task status lookups.

This means:
- the same admin on the same browser gets the richest marker continuity
- cross-browser or cross-user marker sync is not part of the current implementation

## 14. Marker Visualization Requirements

### 14.1 Route Scoping

Only markers whose stored route equals the current route should appear in marker mode.

### 14.2 Resolution Filtering

Markers linked to roadmap tasks marked `done` should not appear in the unresolved marker layer.

### 14.3 Positioning

Markers should anchor to the best current element match using the stored selector when possible. If the element cannot be found, the stored capture bounds serve as fallback positioning.

### 14.4 Clustering

When multiple markers occupy nearby positions:
- they should cluster into a single aggregate marker
- the cluster should expose each underlying ticket for selection

## 15. Data and Content Requirements

### 15.1 Feedback Type

Supported feedback types:
- `bug`
- `enhancement`

### 15.2 Priority

Supported priorities:
- `low`
- `medium`
- `high`
- `critical`

### 15.3 Generated Description Structure

The created roadmap task description must include:
- the admin’s written summary
- route and selector context
- DOM path
- element metadata
- geometry and viewport context
- capture timestamp
- admin identity
- optional text preview

The goal is to keep the roadmap ticket usable even if the marker itself is no longer available later.

## 16. API Requirements

### 16.1 Create Contextual Feedback

Endpoint:
- `POST /api/admin/contextual-feedback`

Access:
- platform admin only

Payload includes:
- title
- description
- feedbackType
- priority
- optional screenshotBase64
- structured context object

Response includes:
- created task identity
- target project
- target workstream
- optional screenshot attachment metadata

### 16.2 Roadmap Task Editing

Endpoint used by widget edit flow:
- `PATCH /api/admin/tasks/:taskId`

### 16.3 Roadmap Attachment APIs

Existing backend support:
- `GET /api/admin/tasks/:taskId/attachments`
- `POST /api/admin/tasks/:taskId/attachments`
- `DELETE /api/admin/tasks/:taskId/attachments/:attachmentId`

Current product note:
- these APIs exist and are part of the feature ecosystem
- the contextual feedback widget currently uses automatic screenshot attachment on create
- a full roadmap-page attachment management experience is not yet exposed in the current roadmap UI

## 17. Data Model Requirements

The feature relies on the existing roadmap data model plus roadmap task attachments.

Key records:
- roadmap projects
- roadmap workstreams
- roadmap tasks
- roadmap task attachments

Important current model behavior:
- task completion dates are maintained by roadmap task status transitions
- project completion is gated by all tasks being done
- completed tasks can sync into executive updates through existing roadmap logic

That means contextual feedback can feed not only implementation intake, but also downstream reporting once work is completed through the roadmap lifecycle.

## 18. Permissions and Security

### 18.1 Role Restrictions

Creation of contextual feedback is restricted to `platform-admin`.

### 18.2 Attachment Upload Restrictions

Roadmap task attachment uploads are restricted to image MIME types:
- PNG
- JPEG
- WebP
- GIF

### 18.3 Safety Boundaries

The widget must ignore its own DOM subtree during inspection so internal controls are not accidentally captured as product targets.

## 19. Functional Requirements

### FR-1 Global Availability for Platform Admins

The system shall render the contextual feedback widget for authenticated platform admins across the app shell.

### FR-2 Mode Cycling

The system shall support `inactive`, `inspect`, and `markers` modes from a single activator control.

### FR-3 Element Inspection

The system shall allow a platform admin to target live UI elements and capture contextual metadata from the selected element.

### FR-4 Cross-Input Selection

The system shall support mouse capture and touch/pen long-press capture.

### FR-5 Structured Ticket Creation

The system shall create a roadmap task directly from the widget without requiring the admin to navigate away first.

### FR-6 Dedicated Intake Routing

The system shall route contextual feedback tickets into the dedicated contextual feedback roadmap project/workstream, auto-creating the target if needed.

### FR-7 Screenshot Support

The system shall attempt screenshot capture automatically after selection and allow ticket creation even if screenshot capture fails.

### FR-8 Screenshot Persistence

When a screenshot is present, the system shall persist it as a roadmap task attachment.

### FR-9 Marker Persistence

The system shall persist marker metadata locally so unresolved tickets can be redisplayed on their originating route.

### FR-10 Marker Filtering

The system shall hide markers whose linked roadmap task is marked `done`.

### FR-11 Marker Clustering

The system shall cluster nearby markers to maintain readability on dense routes.

### FR-12 Ticket Editing

The system shall allow a captured feedback ticket to be reopened and edited from marker mode.

### FR-13 Roadmap Handoff

The system shall allow the admin to jump from a marker to the roadmap workspace.

### FR-14 Activator Position Memory

The system shall persist draggable activator position separately for workspace and public route scopes.

## 20. Non-Functional Requirements

### NFR-1 Low Workflow Friction

The capture flow should require minimal context switching and should remain usable while actively reviewing a page.

### NFR-2 Best-Effort Resilience

Screenshot failure, local storage issues, or missing React component names must degrade gracefully rather than break submission.

### NFR-3 Clear Visual Feedback

Selection, hover targeting, marker presence, and active-marker state should be visually obvious.

### NFR-4 Route-Level Relevance

Marker noise should be constrained to the current route so the overlay remains useful instead of becoming globally cluttered.

### NFR-5 Reproducibility

Each ticket should contain enough structured context that another operator or engineer can understand where it came from without relying on memory.

## 21. Success Criteria

Qualitative success:
- platform admins can capture product issues and improvements without leaving the page where they were discovered
- roadmap tickets contain enough context to reduce clarification loops
- unresolved issues remain visible on the originating route
- the roadmap can serve as the single execution and closure system

Suggested quantitative success metrics for future measurement:
- time from issue discovery to roadmap ticket creation
- percentage of contextual tickets requiring follow-up clarification
- percentage of tickets submitted with screenshot attachment
- percentage of captured tickets that progress to `in-progress` and `done`
- repeat feedback volume on the same route/selector

## 22. Known Limitations

The current implementation has several deliberate boundaries:
- marker persistence is local-browser-based rather than server-synced
- only platform admins can use the feature
- attachment CRUD exists on the backend but is not yet a full roadmap-page UI workflow
- marker identity depends partly on selectors and stored bounds, so substantial UI refactors may weaken historical marker anchoring
- the widget is optimized for intake and revisit, not full issue lifecycle management

## 23. Future Opportunities

Reasonable next-step expansions include:
- server-backed annotation persistence instead of local-only marker storage
- duplicate detection for repeated feedback on the same route/selector
- task-to-marker deep links from the roadmap back to captured route context
- first-class screenshot gallery in roadmap task UI
- comment threads and triage ownership
- broader role access with stricter permissions
- route heatmaps and recurring feedback analytics
- conversion of contextual tickets into structured work items outside the intake workstream

## 24. Open Product Questions

These do not block the current PRD, but they matter for the next iteration:
- Should markers eventually be shared across platform admins, or remain personal capture memory until triaged?
- Should contextual feedback tickets remain in a single intake workstream, or be moved automatically after triage?
- Should screenshot attachments be visible directly in the roadmap task list/detail UI?
- Should the feature eventually support non-platform-admin reviewers with restricted create/edit rights?
- Should the system introduce duplicate warnings when the same selector/route already has open feedback?

## 25. Acceptance Statement

The contextual feedback feature should be considered functionally complete for its current phase when:
- a platform admin can inspect a live page
- select an element
- review captured context
- optionally include a screenshot
- submit a bug or enhancement ticket
- have that ticket created in the dedicated roadmap intake area
- see the unresolved item represented as a marker on the originating route
- reopen the item for editing
- and have the marker disappear once the roadmap task is marked done

