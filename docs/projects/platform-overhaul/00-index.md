# YCM Platform Overhaul — Master Module Index
**Initiative:** Spec-First Platform Overhaul
**Owner:** YCM Command Center
**Process skill:** [`docs/skills/spec-first-overhaul-process-skill.md`](../../skills/spec-first-overhaul-process-skill.md)
**Last updated:** 2026-04-22 (Phase 1 paper-trail sweep reconciled; Task 0 merged via PR #8; waves 1-27 reconciliation in flight)

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

| ID | Name | Status | Decision Doc | Handoff | PPM Task Card |
|---|---|---|---|---|---|
| 0.1 | Dashboard Resolution | **SPEC LOCKED** · handoff ready | [`decisions/0.1-dashboard-resolution.md`](decisions/0.1-dashboard-resolution.md) | [`handoffs/0.1-dashboard-resolution-handoff.md`](handoffs/0.1-dashboard-resolution-handoff.md) | [`ppm/0.1-dashboard-resolution-task.md`](ppm/0.1-dashboard-resolution-task.md) · `a304717b-b18b-4163-9928-5a9ea235d3a7` (queued) |
| 0.2 | Persona Map | **SPEC LOCKED** | [`decisions/0.2-persona-map.md`](decisions/0.2-persona-map.md) | [`handoffs/0.2-persona-map-handoff.md`](handoffs/0.2-persona-map-handoff.md) | [`ppm/0.2-persona-map-task.md`](ppm/0.2-persona-map-task.md) · `5fa11c46-1e93-4991-a4c3-a8c8f3d63558` (queued) |
| 0.3 | Navigation Model | **SPEC LOCKED** | [`decisions/0.3-navigation-model.md`](decisions/0.3-navigation-model.md) | [`handoffs/0.3-navigation-model-handoff.md`](handoffs/0.3-navigation-model-handoff.md) | _pending task card_ |

---

## Layer 1 — IA Taxonomy Cleanup

| ID | Name | Status | Decision Doc | Handoff | PPM Task Card |
|---|---|---|---|---|---|
| 1.1 | Zone taxonomy corrections | **SPEC LOCKED** | [`decisions/1.1-zone-taxonomy-corrections.md`](decisions/1.1-zone-taxonomy-corrections.md) | [`handoffs/1.1-zone-taxonomy-handoff.md`](handoffs/1.1-zone-taxonomy-handoff.md) | `38dca9eb-b494-425d-b16a-f34e70d1ab3a` (queued, medium) — card file pending |
| 1.2 | Section hub reclassification | **SPEC LOCKED** | [`decisions/1.2-section-hub-reclassification.md`](decisions/1.2-section-hub-reclassification.md) | [`handoffs/1.2-section-hub-handoff.md`](handoffs/1.2-section-hub-handoff.md) | `e8cdef51-ea22-40b5-8545-fa050efc8b94` (queued, medium) — card file pending |
| 1.3 | Breadcrumb label audit | **SPEC LOCKED** | [`decisions/1.3-breadcrumb-label-audit.md`](decisions/1.3-breadcrumb-label-audit.md) | [`handoffs/1.3-breadcrumb-label-audit-handoff.md`](handoffs/1.3-breadcrumb-label-audit-handoff.md) | `ac0734d2-88e3-412c-97b7-3e497fd936e1` (queued, medium) — card file pending |
| 1.4 | Page title consistency | **SPEC LOCKED** | [`decisions/1.4-page-title-consistency.md`](decisions/1.4-page-title-consistency.md) | [`handoffs/1.4-page-title-consistency-handoff.md`](handoffs/1.4-page-title-consistency-handoff.md) | `bbcc9c73-7d89-4359-a87c-5ad6e9521f9c` (queued, high) — card file pending |

---

## Layer 2 — Role & Permission Model

| ID | Name | Status | Decision Doc | Handoff | PPM Task Card |
|---|---|---|---|---|---|
| 2.1 | Role model audit | **SPEC LOCKED** | [`decisions/2.1-role-model-audit.md`](decisions/2.1-role-model-audit.md) | [`handoffs/layer-2-primitives-handoff.md`](handoffs/layer-2-primitives-handoff.md) (bundle) | `a84162c2-cb6d-4bb0-b889-29a953b75f20` (queued, critical) — Layer-2 Primitives Bundle; card file pending |
| 2.2 | Owner Portal access boundaries | **SPEC LOCKED** | [`decisions/2.2-owner-portal-access-boundaries.md`](decisions/2.2-owner-portal-access-boundaries.md) | [`handoffs/layer-2-primitives-handoff.md`](handoffs/layer-2-primitives-handoff.md) (bundle) | `a84162c2-cb6d-4bb0-b889-29a953b75f20` (queued, critical) — Layer-2 Primitives Bundle; card file pending |
| 2.3 | Permission boundary corrections | **SPEC LOCKED** | [`decisions/2.3-permission-boundary-corrections.md`](decisions/2.3-permission-boundary-corrections.md) | [`handoffs/layer-2-primitives-handoff.md`](handoffs/layer-2-primitives-handoff.md) (bundle) | `a84162c2-cb6d-4bb0-b889-29a953b75f20` (queued, critical) — Layer-2 Primitives Bundle; card file pending |
| 2.4 | Platform-admin surface audit | **SPEC LOCKED** | [`decisions/2.4-platform-admin-surface-audit.md`](decisions/2.4-platform-admin-surface-audit.md) | [`handoffs/2.4-platform-admin-surface-audit-handoff.md`](handoffs/2.4-platform-admin-surface-audit-handoff.md) | `043c1502-ab03-4e3e-a66e-49dae5f9840b` (queued, high) — card file pending |

---

## Layer 3 — Navigation Restructure

| ID | Name | Status | Decision Doc | Handoff | PPM Task Card |
|---|---|---|---|---|---|
| 3.1 | Sidebar redesign | **SPEC LOCKED** | [`decisions/3.1-sidebar-redesign.md`](decisions/3.1-sidebar-redesign.md) | [`handoffs/3.1-sidebar-redesign-handoff.md`](handoffs/3.1-sidebar-redesign-handoff.md) | `bb5baae3-7daf-4503-8767-1ee182b4b4e0` (queued, high) — card file pending |
| 3.2 | Route restructure | **SPEC LOCKED** (amendment pending — `/app/settings/billing` from 4.4 Q6) | [`decisions/3.2-route-restructure.md`](decisions/3.2-route-restructure.md) | [`handoffs/3.2-route-restructure-handoff.md`](handoffs/3.2-route-restructure-handoff.md) | `b38ac77c-dc83-4076-9bb8-a62d8ff9e5fb` (queued, high) — card file pending |
| 3.3 | Role-gating corrections | **SPEC LOCKED** | [`decisions/3.3-role-gating-corrections.md`](decisions/3.3-role-gating-corrections.md) | [`handoffs/3.3-role-gating-corrections-handoff.md`](handoffs/3.3-role-gating-corrections-handoff.md) | `7b23d9c6-b087-4063-9c70-ec3e731c7963` (queued, high) — card file pending |
| 3.4 | Breadcrumb implementation | **SPEC LOCKED** | [`decisions/3.4-breadcrumb-implementation.md`](decisions/3.4-breadcrumb-implementation.md) | [`handoffs/3.4-breadcrumb-implementation-handoff.md`](handoffs/3.4-breadcrumb-implementation-handoff.md) | `c23a5d54-f784-476b-8f8f-3dcc78024c17` (queued, medium) — card file pending |
| 3.5 | Owner Portal restructure | **IN SPEC** (skeleton) | [`decisions/3.5-owner-portal-restructure.md`](decisions/3.5-owner-portal-restructure.md) | [`handoffs/3.5-owner-portal-restructure-handoff.md`](handoffs/3.5-owner-portal-restructure-handoff.md) | skeleton/decision: `65ae5d6b-9eee-407d-ac7e-c3fdd64aa67c`; build: `ca6972a3-6b9e-4620-9358-c1cc6c9f42e3` (queued, medium) — card files pending |

---

## Layer 4 — Feature Gaps

| ID | Name | Status | Decision Doc |
|---|---|---|---|
| 4.1 | Cross-association alert engine | IN SPEC (skeleton) | [`decisions/4.1-cross-association-alert-engine.md`](decisions/4.1-cross-association-alert-engine.md) |
| 4.2 | Owner portal gaps | IN SPEC (skeleton) | [`decisions/4.2-owner-portal-gaps.md`](decisions/4.2-owner-portal-gaps.md) |
| 4.3 | Recurring assessment rules engine | IN SPEC (skeleton) | [`decisions/4.3-recurring-assessment-rules-engine.md`](decisions/4.3-recurring-assessment-rules-engine.md) |
| 4.4 | Signup and checkout flow | IN SPEC (skeleton, Q1+Q3 resolved) | [`decisions/4.4-signup-and-checkout-flow.md`](decisions/4.4-signup-and-checkout-flow.md) |

---

## Layer 5 — Polish & Hardening

| ID | Name | Status | Decision Doc |
|---|---|---|---|
| 5.1 | Empty states | QUEUED | _not yet drafted_ |
| 5.2 | Error states | QUEUED | _not yet drafted_ |
| 5.3 | Mobile audit | QUEUED | _not yet drafted_ |
| 5.4 | Performance audit | QUEUED | _not yet drafted_ |

---

## ADRs — Architectural Decision Records

Cross-cutting architectural decisions that span multiple modules are captured as ADRs under `adrs/`. These are distinct from per-module decision docs: they define contracts and primitives that individual module specs depend on.

| ID | Title | Status | Doc |
|---|---|---|---|
| 0b | RouteGuard + persona-access contract | **PROPOSED** · pending William signoff | [`adrs/0b-routeguard-personaaccess-contract.md`](adrs/0b-routeguard-personaaccess-contract.md) |

---

## Change Log

| Date | Author | Change |
|---|---|---|
| 2026-04-14 | Claude documentation agent | Initial publication. Module 0.1 at SPEC LOCKED; all other modules at QUEUED. |
| 2026-04-14 | Claude documentation agent | PPM task card created for module 0.1 (`a304717b-b18b-4163-9928-5a9ea235d3a7`, queued). Task card file: `ppm/0.1-dashboard-resolution-task.md`. |
| 2026-04-14 | Claude documentation agent | Handoff doc published for module 0.1: `handoffs/0.1-dashboard-resolution-handoff.md`. Build gate cleared; Computer may begin on operator activation. |
| 2026-04-14 | YCM CC + Founder | Module 0.2 (Persona Map) SPEC LOCKED. Three personas confirmed: Manager, Board Admin (old role, since renamed), Owner. Owner Portal HOA payments and bill history explicitly out of overhaul scope. |
| 2026-04-14 | Claude documentation agent | Module 0.3 (Navigation Model) skeleton drafted at `decisions/0.3-navigation-model.md`. Status IN SPEC. Nine conflicts enumerated (Q1–Q9); Selected Resolution and Acceptance Criteria marked PENDING YCM CC + Founder decision. Not yet lockable. |
| 2026-04-14 | Claude documentation agent | PPM task card created for module 0.2 (`5fa11c46-1e93-4991-a4c3-a8c8f3d63558`, queued). Governance card — enforces 0.2 boundary matrix across Layer 2 / Layer 3 work. No direct build; verified as downstream modules close. |
| 2026-04-14 | Founder (William) + Claude documentation agent | Module 0.3 (Navigation Model) SPEC LOCKED. Nine resolutions recorded: single canonical role-filtered sidebar, functional grouping, distinct persona landings within shared `/app` shell (Q3 reinterpreted to honor locked 0.2), shallow breadcrumbs, strict role isolation, 6–7 section ceiling for Manager/Board Officer/Assisted Board with tighter Owner, header association switcher with portfolio page as supporting surface, one canonical home per persona, central updates/inbox. Layer 0 fully locked. |
| 2026-04-14 | Claude documentation agent | Layer 1 skeletons drafted (1.1 Zone taxonomy, 1.2 Section hub, 1.3 Breadcrumb audit, 1.4 Page title) — all at IN SPEC (skeleton) with Selected Resolution and Acceptance Criteria marked PENDING YCM CC + Founder decision. No resolutions written; conflict analyses and open-question sets enumerated. |
| 2026-04-15 | Founder (William) + Claude documentation agent | Layer 1 fully locked. 1.1 five-zone model (Home/Financials/Operations/Governance/Communications + Owner-portal 4 zones), zone-tag comment format, assignment rubric. 1.2 hub definition + composition + zone-root URL convention + zone-label-only naming (no "Hub"/"Overview" suffix; "Overview" reserved for dashboards). 1.3 association-name/zone-label root rule, two-pattern chain, centralized component, persona-invariant, mobile single-level collapse below 768px. 1.4 `{Page Title} — YCM` document-title format, `useDocumentTitle` hook as sole mechanism, six Dashboard renames, platform-wide Dashboard prohibition, portal parity, 44-route table as implementation output. Cross-Reference Notices in 1.1 and 1.4 flag Q4 rename/example tension with 0.1 AC 1 (``/app`` = "Home"); 0.1 lock preserved unless formally amended. Implementation sequence: 1.4 → 1.1 → 1.3 → 1.2. 0.1 build handoff holds until 1.1 and 1.4 implementation outputs are committed. |
| 2026-04-15 | Claude documentation agent (4 parallel agents) | Layer 2 skeletons drafted (2.1 Role model audit, 2.2 Owner Portal access boundaries, 2.3 Permission boundary corrections, 2.4 Platform-admin surface audit). All IN SPEC (skeleton); Selected Resolution + Acceptance Criteria PENDING throughout. Notable surfacing: 13 schema-defined role strings + 10 alias accepted by `normalizeAdminRole` (vs. 0.2's 3 personas / 2 operator roles); a full Board-Admin-in-portal subsurface with 29 `/api/portal/board/*` endpoints exists in code but absent from 0.2 §Persona 5 (Q1 of 2.2 blocks 2.3/2.4); `App.tsx:1051-1057` shunts every `board-admin` (old role) to `BoardPortal` contradicting 0.3 Q1/Q3 shared-shell principle; 31 of 40 `/app/*` pages have no client route gate; 3 of 6 platform-admin surfaces have APIs that permit roles beyond `platform-admin`. Cross-Reference Notices embedded in 2.1, 2.2, 2.3, 2.4 against 0.2 AC 1, 0.3 AC 1–4 / AC 9–15 / AC 21–22, 1.1 Q1/Q5, 1.2 Q4, 1.4 Q7. No resolutions written. |
| 2026-04-15 | Founder (William) + Claude documentation agent | Module 2.1 (Role model audit) SPEC LOCKED. Founder Q1/Q2/Q10 decisions: platform-admin added as 4th operator persona (requires 0.2 amendment, queued as separate commit); viewer kept as capability variant of Manager, default `viewer` preserved; vendor portal out of scope for this overhaul (flagged for future Layer 0 decision). Q3–Q9/Q11 derived from locked content: portal sub-roles collapse to `owner` (per 0.2 §Persona 3 + 2.2 Q1 containment pattern); single canonical `AdminRole` from `shared/adminUserRoleEnum`; `normalizeAdminRole` alias migrate + remove; `canAccess` strict-false on null role (per 0.3 AC 21); `PortalRequest` role fields retyped to enum literal; 544-handler classification table queued as implementation output; hub-visibility vocabulary decoupled via rename migration. Queued follow-ups: 0.2 Persona 4 amendment, Q5 production data audit, Q9 classification table, Q11 rename migration, 2.4 Q1 cascade update. |
| 2026-04-15 | Claude documentation agent (index bookkeeping) | Module 2.3 (Permission boundary corrections) row synced to **SPEC LOCKED** — reflects lock committed at `7156c8a`. Amendment to 0.2 (AC 4 + AC 5 PM-managed-mode qualifiers) committed at `58b3a8c` fulfills the follow-up queued in `ae76a3f` (2.2 Q1 resolution). |
| 2026-04-15 | Founder (William) + Claude documentation agent | Module 2.2 (Owner Portal access boundaries) SPEC LOCKED. Q2–Q7 all derived from locked content (no new founder judgment): Q2 portal role enum collapses to `owner` (from 2.1 Q3); Q3 owner-mutation approval gates status-quo preserved (from 0.2 §Persona 3 live capability list); Q4 portalHasBoardAccess branching moot via 2.2 Q1 + 2.1 containment; Q5 public payment-link namespace status-quo preserved; Q6 `/portal/amenities` inherits `/portal` session-redirect pattern (from 0.2 + 0.3 Q5); Q7 1.x ↔ 2.2 sequencing deferred to build-phase coordination. Layer 2 now: 2.1/2.2/2.3 LOCKED; 2.4 remaining. |
| 2026-04-15 | Founder (William) + Claude documentation agent | Module 2.4 (Platform-admin surface audit) SPEC LOCKED. Q1–Q7 derived from locked content and the 2.1 Q1 operator-tier formalization: Q1 folds into the 2.1-queued 0.2 Persona 4 amendment (single amendment, not fragmented); Q2 adopts 2.3's `<RouteGuard>` pattern; Q3 and Q7 narrow all platform/admin/ai endpoints (reads + writes + diagnostics) to `["platform-admin"]` per 0.3 Q5 AC 22; Q4 narrows `platformSubPages` tab-bar lists to match sidebar; Q5 removes the Owner Portal launcher from platform nav per 0.2 persona isolation; Q6 amends 1.1 to add a sixth zone **Platform** (separate-commit follow-up). **Layer 2 fully locked (2.1, 2.2, 2.3, 2.4).** Queued Layer-0/1 amendments: (a) 0.2 Persona 4 Platform Admin, (b) 1.1 sixth zone Platform. |
| 2026-04-15 | YCM CC (William confirmed) | 0.2 amended at `f8dbf76` — Persona 4 Platform Admin added; boundary matrix extended with Platform Admin column; ACs 11/12/13 added. 1.1 amended at `ac446c0` — sixth zone Platform added to Q1/Q3/Q4. Both amendments triggered by 2.1 Q1 + 2.4 Q1 + 2.4 Q6 resolutions. Layer 0 + Layer 1 now fully aligned with 4-persona / 6-zone model (later expanded to 6-persona model on 2026-04-16). |
| 2026-04-15 | Claude documentation agent (4 parallel agents) | Layer 3 skeletons drafted (3.1 Sidebar redesign, 3.2 Route restructure, 3.3 Role-gating corrections, 3.4 Breadcrumb implementation). All IN SPEC (skeleton); every Selected Resolution + Acceptance Criteria PENDING. 3.1 enumerates 12 Qs (zone-group labels, active-association grouping, zone-click behavior, Home placement, Board Officer / Assisted Board mode branching, PM toggle runtime, toggle config surface, Platform zone visibility, RouteGuard↔sidebar SoT, association switcher placement, Owner Portal launcher retirement scope, legacy zone assignment); 3.2 enumerates 7 Qs across 52 route entries + 43 legacy redirects; 3.3 enumerates 12 Qs sequencing remediation across 2.1/2.2/2.3/2.4; 3.4 enumerates 10 Qs against 37 breadcrumb surfaces. Cross-Reference Notices embedded in all four modules guarding against re-deciding locked Layer 0/1/2 content. |
| 2026-04-15 | YCM CC (William confirmed) | 6-persona model rename: board-admin split into board-officer (self-managed), assisted-board (PM-managed), pm-assistant (PM junior staff). 0.2 restructured. All decision docs updated. |
| 2026-04-16 | Founder (William) + YCM CC | 3.3 fully locked (12 Qs resolved). 4.4 Q1 + Q3 resolved. Signup role bug fixed (commit `aa30fa2`). 3.3 spec aligned (commit `7f49e17`). CPU execution plan approved: 8-task sequence covering test infra, planCatalog wiring, parity harness, and 5 zone landings. |
| 2026-04-16 | YCM CPU (Computer Executor) | Task 0 (Vitest infrastructure) dispatched → PR #8 opened by VS Code Claude → reviewed and merged. 14 tests, 10 files, 1673 insertions. All 9 AC verified. |
| 2026-04-16 | YCM CPU (Computer Executor) | Task 1 (planCatalog wiring) and Task 2 (parity harness) handoff specs pushed to `docs/projects/platform-overhaul/handoffs/`. Both ready for dispatch. Tasks 1+2 run in parallel after Task 0 merge. |
| 2026-04-21 | Founder (William) + Claude documentation agent | Layer 4 partial locks: **4.1 Q2/Q3/Q4** (dual Home-panel + `/app/communications/inbox` inbox; single-zone alert ownership), **4.2 Q1/Q4/Q5** (new Layer-3 module 3.5 Owner Portal Restructure owns mega-file split; hybrid Community integration; session-gate + title-parity patches land in-place), **4.3 Q1/Q2/Q4** (retire `hoaFeeSchedules` → migrate into `recurringChargeSchedules`; status-quo sweep-based delinquency), **4.4 Q2/Q5/Q6/Q7** (banner-on-Home onboarding; 14-day trial + 7-day grace + hard lock; Manager-only `/app/settings/billing` surface; auto-authenticate on signup complete with magic-link fallback). Consolidated follow-ups: (a) create `decisions/3.5-owner-portal-restructure.md` skeleton, (b) 3.2 route-table amendment for `/app/settings/billing`, (c) PPM workitem for `hoaFeeSchedules` → `recurringChargeSchedules` migration, (d) PPM workitem for signup session-continuity wiring, (e) 4.4 Q4 (Phase 0 billing table migration) remains open. All other PENDING Qs (4.1 Q1/Q5–Q9, 4.2 Q2/Q3/Q6, 4.3 Q3/Q5–Q9, 4.4 Q4) stay PENDING. |
| 2026-04-21 | Claude documentation agent (Phase 1 paper-trail sweep, 3 waves) | Drafted 13 handoff docs — bespoke for 3.3, 3.2, 3.1, 3.5, layer-2-primitives; parallel mechanical for 0.2, 0.3, 1.1, 1.2, 1.3, 1.4, 2.4, 3.4. Drafted 3.5 Owner Portal Restructure decision doc skeleton (IN SPEC, Q1–Q8 PENDING). Authored ADR 0b (RouteGuard + persona-access contract) in `adrs/` — PROPOSED pending William signoff with 5 flagged open questions (OQ-1 through OQ-5). Updated all affected module status rows. Paper-trail bucket complete; Phase 0b.2 stub implementation blocked on ADR signoff. |
| 2026-04-21 | Claude documentation agent (Phase 1 paper-trail sweep — PPM workitem filings) | Filed 12 PPM workitems (one per module without an existing card) covering 0.3, 1.1–1.4, 2.1–2.4 (as Layer-2 bundle), 3.1–3.5. IDs captured in layer tables. Task card .md files pending next wave. |
| 2026-04-22 | Claude Code + 4 agents | PR 1 of 5-PR reconciliation: cherry-picked Task 0 Vitest ACs (`2d72e1a`) + Phase 1 paper-trail sweep (`ade73f7`) + Layer 4 partial locks (`5d6e619`) + migration journal cleanup for 0002-0007 drift. Resolved 00-index conflicts by taking superset of HEAD + branch histories. Replaces the interim "CPU Execution Status" section (Tasks 1-7) with this 5-PR reconciliation. |
