# YCM Platform Overhaul — Master Module Index
**Initiative:** Spec-First Platform Overhaul
**Owner:** YCM Command Center
**Process skill:** [`docs/skills/spec-first-overhaul-process-skill.md`](../../skills/spec-first-overhaul-process-skill.md)
**Last updated:** 2026-04-14 (PPM task card published for 0.1)

---

This file is the canonical status index for every module across Layers 0–5 of the YCM Platform Overhaul. Agents must consult this index to determine the current state of any module before acting. When a module status changes, this file must be updated in the same commit.

Status definitions are defined in the process skill ("Module Status Definitions"). The short form:

- **QUEUED** — not yet started
- **IN SPEC** — spec being drafted
- **SPEC LOCKED** — decision doc finalized; PPM task card may be created
- **IN BUILD** — Computer is implementing
- **IN REVIEW** — build complete, under review
- **COMPLETE** — merged
- **BLOCKED** — cannot proceed

No module may enter build until its governing spec is SPEC LOCKED and a PPM task card and handoff doc exist. Layers must lock top-down: a layer may not begin implementation until the layer above it has reached SPEC LOCKED.

---

## Layer 0 — Foundational Decisions

| ID | Name | Status | Decision Doc | PPM Task Card |
|---|---|---|---|---|
| 0.1 | Dashboard Resolution | **SPEC LOCKED** · handoff ready | [`decisions/0.1-dashboard-resolution.md`](decisions/0.1-dashboard-resolution.md) | [`ppm/0.1-dashboard-resolution-task.md`](ppm/0.1-dashboard-resolution-task.md) · `a304717b-b18b-4163-9928-5a9ea235d3a7` (queued) · [handoff](handoffs/0.1-dashboard-resolution-handoff.md) |
| 0.2 | Persona Map | **SPEC LOCKED** | [`decisions/0.2-persona-map.md`](decisions/0.2-persona-map.md) | [`ppm/0.2-persona-map-task.md`](ppm/0.2-persona-map-task.md) · `5fa11c46-1e93-4991-a4c3-a8c8f3d63558` (queued) |
| 0.3 | Navigation Model | **SPEC LOCKED** | [`decisions/0.3-navigation-model.md`](decisions/0.3-navigation-model.md) | _pending task card_ |

---

## Layer 1 — IA Taxonomy Cleanup

| ID | Name | Status | Decision Doc |
|---|---|---|---|
| 1.1 | Zone taxonomy corrections | **SPEC LOCKED** | [`decisions/1.1-zone-taxonomy-corrections.md`](decisions/1.1-zone-taxonomy-corrections.md) |
| 1.2 | Section hub reclassification | **SPEC LOCKED** | [`decisions/1.2-section-hub-reclassification.md`](decisions/1.2-section-hub-reclassification.md) |
| 1.3 | Breadcrumb label audit | **SPEC LOCKED** | [`decisions/1.3-breadcrumb-label-audit.md`](decisions/1.3-breadcrumb-label-audit.md) |
| 1.4 | Page title consistency | **SPEC LOCKED** | [`decisions/1.4-page-title-consistency.md`](decisions/1.4-page-title-consistency.md) |

---

## Layer 2 — Role & Permission Model

| ID | Name | Status | Decision Doc |
|---|---|---|---|
| 2.1 | Role model audit | **SPEC LOCKED** | [`decisions/2.1-role-model-audit.md`](decisions/2.1-role-model-audit.md) |
| 2.2 | Owner Portal access boundaries | IN SPEC (skeleton) | [`decisions/2.2-owner-portal-access-boundaries.md`](decisions/2.2-owner-portal-access-boundaries.md) |
| 2.3 | Permission boundary corrections | IN SPEC (skeleton) | [`decisions/2.3-permission-boundary-corrections.md`](decisions/2.3-permission-boundary-corrections.md) |
| 2.4 | Platform-admin surface audit | IN SPEC (skeleton) | [`decisions/2.4-platform-admin-surface-audit.md`](decisions/2.4-platform-admin-surface-audit.md) |

---

## Layer 3 — Navigation Restructure

| ID | Name | Status | Decision Doc |
|---|---|---|---|
| 3.1 | Sidebar redesign | QUEUED | _not yet drafted_ |
| 3.2 | Route restructure | QUEUED | _not yet drafted_ |
| 3.3 | Role-gating corrections | QUEUED | _not yet drafted_ |
| 3.4 | Breadcrumb implementation | QUEUED | _not yet drafted_ |

---

## Layer 4 — Feature Gaps

| ID | Name | Status | Decision Doc |
|---|---|---|---|
| 4.1 | Cross-association alert engine | QUEUED | _not yet drafted_ |
| 4.2 | Owner portal gaps | QUEUED | _not yet drafted_ |
| 4.3 | Recurring assessment rules engine | QUEUED | _not yet drafted_ |
| 4.4 | Signup and checkout flow | QUEUED | _not yet drafted_ |

---

## Layer 5 — Polish & Hardening

| ID | Name | Status | Decision Doc |
|---|---|---|---|
| 5.1 | Empty states | QUEUED | _not yet drafted_ |
| 5.2 | Error states | QUEUED | _not yet drafted_ |
| 5.3 | Mobile audit | QUEUED | _not yet drafted_ |
| 5.4 | Performance audit | QUEUED | _not yet drafted_ |

---

## Change Log

| Date | Author | Change |
|---|---|---|
| 2026-04-14 | Claude documentation agent | Initial publication. Module 0.1 at SPEC LOCKED; all other modules at QUEUED. |
| 2026-04-14 | Claude documentation agent | PPM task card created for module 0.1 (`a304717b-b18b-4163-9928-5a9ea235d3a7`, queued). Task card file: `ppm/0.1-dashboard-resolution-task.md`. |
| 2026-04-14 | Claude documentation agent | Handoff doc published for module 0.1: `handoffs/0.1-dashboard-resolution-handoff.md`. Build gate cleared; Computer may begin on operator activation. |
| 2026-04-14 | YCM CC + Founder | Module 0.2 (Persona Map) SPEC LOCKED. Three personas confirmed: Manager, Board Admin, Owner. Owner Portal HOA payments and bill history explicitly out of overhaul scope. |
| 2026-04-14 | Claude documentation agent | Module 0.3 (Navigation Model) skeleton drafted at `decisions/0.3-navigation-model.md`. Status IN SPEC. Nine conflicts enumerated (Q1–Q9); Selected Resolution and Acceptance Criteria marked PENDING YCM CC + Founder decision. Not yet lockable. |
| 2026-04-14 | Claude documentation agent | PPM task card created for module 0.2 (`5fa11c46-1e93-4991-a4c3-a8c8f3d63558`, queued). Governance card — enforces 0.2 boundary matrix across Layer 2 / Layer 3 work. No direct build; verified as downstream modules close. |
| 2026-04-14 | Founder (William) + Claude documentation agent | Module 0.3 (Navigation Model) SPEC LOCKED. Nine resolutions recorded: single canonical role-filtered sidebar, functional grouping, distinct persona landings within shared `/app` shell (Q3 reinterpreted to honor locked 0.2), shallow breadcrumbs, strict role isolation, 6–7 section ceiling for Manager/Board with tighter Owner, header association switcher with portfolio page as supporting surface, one canonical home per persona, central updates/inbox. Layer 0 fully locked. |
| 2026-04-14 | Claude documentation agent | Layer 1 skeletons drafted (1.1 Zone taxonomy, 1.2 Section hub, 1.3 Breadcrumb audit, 1.4 Page title) — all at IN SPEC (skeleton) with Selected Resolution and Acceptance Criteria marked PENDING YCM CC + Founder decision. No resolutions written; conflict analyses and open-question sets enumerated. |
| 2026-04-15 | Founder (William) + Claude documentation agent | Layer 1 fully locked. 1.1 five-zone model (Home/Financials/Operations/Governance/Communications + Owner-portal 4 zones), zone-tag comment format, assignment rubric. 1.2 hub definition + composition + zone-root URL convention + zone-label-only naming (no "Hub"/"Overview" suffix; "Overview" reserved for dashboards). 1.3 association-name/zone-label root rule, two-pattern chain, centralized component, persona-invariant, mobile single-level collapse below 768px. 1.4 `{Page Title} — YCM` document-title format, `useDocumentTitle` hook as sole mechanism, six Dashboard renames, platform-wide Dashboard prohibition, portal parity, 44-route table as implementation output. Cross-Reference Notices in 1.1 and 1.4 flag Q4 rename/example tension with 0.1 AC 1 (``/app`` = "Home"); 0.1 lock preserved unless formally amended. Implementation sequence: 1.4 → 1.1 → 1.3 → 1.2. 0.1 build handoff holds until 1.1 and 1.4 implementation outputs are committed. |
| 2026-04-15 | Claude documentation agent (4 parallel agents) | Layer 2 skeletons drafted (2.1 Role model audit, 2.2 Owner Portal access boundaries, 2.3 Permission boundary corrections, 2.4 Platform-admin surface audit). All IN SPEC (skeleton); Selected Resolution + Acceptance Criteria PENDING throughout. Notable surfacing: 13 schema-defined role strings + 10 alias accepted by `normalizeAdminRole` (vs. 0.2's 3 personas / 2 operator roles); a full Board-Admin-in-portal subsurface with 29 `/api/portal/board/*` endpoints exists in code but absent from 0.2 §Persona 3 (Q1 of 2.2 blocks 2.3/2.4); `App.tsx:1051-1057` shunts every `board-admin` to `BoardPortal` contradicting 0.3 Q1/Q3 shared-shell principle; 31 of 40 `/app/*` pages have no client route gate; 3 of 6 platform-admin surfaces have APIs that permit roles beyond `platform-admin`. Cross-Reference Notices embedded in 2.1, 2.2, 2.3, 2.4 against 0.2 AC 1, 0.3 AC 1–4 / AC 9–15 / AC 21–22, 1.1 Q1/Q5, 1.2 Q4, 1.4 Q7. No resolutions written. |
| 2026-04-15 | Founder (William) + Claude documentation agent | Module 2.1 (Role model audit) SPEC LOCKED. Founder Q1/Q2/Q10 decisions: platform-admin added as 4th operator persona (requires 0.2 amendment, queued as separate commit); viewer kept as capability variant of Manager, default `viewer` preserved; vendor portal out of scope for this overhaul (flagged for future Layer 0 decision). Q3–Q9/Q11 derived from locked content: portal sub-roles collapse to `owner` (per 0.2 §Persona 3 + 2.2 Q1 containment pattern); single canonical `AdminRole` from `shared/adminUserRoleEnum`; `normalizeAdminRole` alias migrate + remove; `canAccess` strict-false on null role (per 0.3 AC 21); `PortalRequest` role fields retyped to enum literal; 544-handler classification table queued as implementation output; hub-visibility vocabulary decoupled via rename migration. Queued follow-ups: 0.2 Persona 4 amendment, Q5 production data audit, Q9 classification table, Q11 rename migration, 2.4 Q1 cascade update. |
