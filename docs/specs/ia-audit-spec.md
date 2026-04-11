# Your Condo Manager — Information Architecture Audit Spec

**Workstream ID:** ycm-ia-audit-2026-04
**Status:** DRAFT (Phase 0 alignment — not yet dispatched; awaiting owner acceptance)
**Authors:** williamruiz1 + Claude (session 2026-04-11)
**Scope:** `/app/*` only — the YCM admin / operator workspace. Other surfaces (`/portal/*`, `/vendor-portal`, `/community/:id`, `/signup/*`, marketing pages at `/`, `/pricing`, `/solutions`, legal) are out of scope for this run and will be addressed in follow-on audits per playbook §D "one audit per surface".
**Playbook:** `docs/playbooks/website-page-cleanup-playbook.md` (v1, 2026-04-11)
**Blocks:** downstream tier-scaling / packaging exercise (§1.2 bullet 8).

---

## 1. Problem statement

The owner has explicitly deferred concrete symptom bullets and asked for a **persona-POV semantic reorganization**: assume every user has access to every page, audit the workspace from the viewpoint of each distinct YCM persona, and produce a nav tree that makes sense to each of them in their own frame. Tier-gating decisions are downstream.

The observable symptoms that justify running the playbook (≥3 of 6 trigger criteria from playbook §0.1) are:

1. **Nav scale at threshold.** ~29 nav items across three sidebar groups (Overview, Association workspace, Platform) plus footer Settings / Help Center. Criterion 1 met.
2. **Partial-consolidation residue.** The team already merged several Financial sub-pages into hub pages (`/app/financial/foundation|billing|expenses|reports`) and several Governance sub-pages into `/app/governance`. 18 legacy paths still resolve via `<RouteRedirect>` in `client/src/App.tsx`. **The .tsx source files for the deprecated pages are still on disk** — 8 financial (`financial-budgets|utilities|recurring-charges|reconciliation|invoices|late-fees|ledger|assessments`) + 4 governance (`governance-compliance|meetings|board-packages|elections|election-ballot|election-detail`). Whether the new hubs fully cover the old pages' content is an open question the audit must answer. Criterion 2 + 3 both met.
3. **Persona confusion in Platform Controls.** `client/src/components/app-sidebar.tsx:184-189` nests **Owner Portal** (a resident-facing `/portal` surface) under Platform Controls alongside operator-only things like Admin Roadmap and AI Ingestion. Either Owner Portal is a launcher shortcut that doesn't belong in an operator menu, or the menu is misnamed. Criterion 5 met.
4. **Peer-level ambiguity.** Insurance is a top-level sibling of Finance, Board, Operations, and Community Hub. Is insurance a Zone 1 operational surface or a Zone 2 document-vault reference surface? The current placement doesn't commit.
5. **Three possible "command centers" live in parallel.** Dashboard (`/app`), Portfolio (`/app/portfolio`), and Operations Dashboard (`/app/operations/dashboard`) all claim some form of at-a-glance status. It's not obvious from the nav which is primary and what each one is supposed to summarize.
6. **Recently added pages without full integration.** `amenities.tsx`, `amenities-admin.tsx`, and `amenity-booking` nav entry are all recent. The `/app/amenities` route renders `AmenitiesAdminPage` — the resident-facing `amenities.tsx` is only reachable from `/portal/amenities`. This is a naming / placement question the audit should decide.
7. **No clear Zone-2 boundary in the sidebar.** The sidebar does not visibly separate "set up the association once" from "run the association daily". Setup-ish surfaces (Associations, Insurance as document, Documents, Help Center) sit interleaved with operational surfaces.
8. **Blocks downstream tier scaling.** The owner has stated that a tier/pricing/packaging exercise depends on pages meaning what they say. Criterion 6 met.

## 2. Goals

1. **Every `/app/*` page has exactly one primary persona, one taxonomy category, and one zone assignment** by the end of Phase 1.
2. **Every page has exactly one verdict** from the §9 vocabulary, with a target and rationale for every non-`KEEP`.
3. **Zero orphan `.tsx` files under `client/src/pages/`** after Phase 6. Every file is either live-routed, explicitly killed, or deliberately staged with a ticket.
4. **Phase 5 proposal produces a nav tree that makes semantic sense when rendered through each primary persona's lens** (platform-admin, manager, board-admin, viewer). Tier-gating decisions are NOT made in this audit — only persona/zone classification.
5. **Zone 3 (platform operator) cleanly separable** from Zone 1+2 such that a future permission gate or separate admin shell can be implemented without further IA work.
6. **All legacy financial + governance redirect targets either retired (KILL) or re-promoted (ORPHAN-SURFACE)** — i.e. no file stays on disk purely because its route redirects somewhere else.
7. **DEMOTE-ADMIN candidates cross-referenced against `server/routes.ts` inline role checks** so Phase 5 flags where a page move would also need a corresponding API role check added.

## 3. Non-goals

Per playbook §0.2 plus YCM-specific:

- **No tier / pricing / packaging decisions.** Owner has deferred this to a downstream exercise. The rubric's cognitive-load hint (dimension 8) is recorded but does NOT drive verdicts.
- **No framework, router, or component-library changes.** Wouter stays. `shadcn` stays. Drizzle schema in `shared/schema.ts` stays.
- **No changes to surfaces outside `/app/*`.** `/portal/*`, `/vendor-portal`, `/community/:id`, `/signup/*`, marketing pages, and legal pages are out of scope. They will be audited in follow-on runs.
- **No rewrite of the inline server-side role checks.** `server/routes.ts` currently enforces permissions inline per-route (~30+ `res.status(403)` checks). The audit may *observe* gaps but does not close them.
- **No new features.** New hubs may be proposed as merge targets, but they exist purely to absorb merged pages — not to ship new capability.
- **No schema changes.** Any `KILL` verdict that would orphan database tables is flagged; actual schema migration is a Phase 6 follow-on.
- **No changes to authentication.** `server/auth.ts` (Google OAuth + session restore) is not in scope.

## 4. Constraints

| ID | Name | Statement |
|---|---|---|
| **C1** | Operator invisibility | Zone 3 pages must be cleanly excludable from customer navigation. Current client-side mechanism is `roles: AdminRole[]` filter in `app-sidebar.tsx` + `canAccessWipRoute`. That is the minimum floor. |
| **C2** | Triplet rule (UI ↔ API) | Every `/app/*` page is backed by API routes in `server/routes.ts`. A `KILL` verdict must name every API route affected and state: keep / deprecate / delete. Phase 5 enumerates these. |
| **C3** | Inline server auth is source of truth | Server-side permission is inline per-route (`adminUser.role !== "platform-admin"` style), NOT middleware. Phase 5 DEMOTE-ADMIN verdicts must cross-reference whether the underlying API already checks role. A demoted page with an ungated API is a known-gap flag, not a blocker. |
| **C4** | Drizzle schema stability | `shared/schema.ts` is not modified by page moves. Any `KILL` that would want to drop a table is a Phase 6 follow-on, not part of this audit. |
| **C5** | No page moves in Phase 1–4 | Auditors observe and propose. They do not edit, rename, or delete. |
| **C6** | Orphan handling | Pages on disk whose only reachable route is a `<RouteRedirect>` target (i.e. the legacy financial and governance pages) are `KILL` candidates — BUT Phase 2 must first confirm the redirect target hub actually covers the file's content. A file whose content isn't covered gets `ORPHAN-SURFACE` with a target hub where it re-attaches. |
| **C7** | Wouter + RouteRedirect is the canonical deprecation pattern | New deprecations follow the same pattern (`<RouteRedirect to="/app/hub" />`). Proposals must use it, not inline conditional redirects. |
| **C8** | PPM tooling currently offline | `mcp__pocketpm__*` tools are not loaded in this session and `ppm` CLI is not installed. Audit state is recorded in this spec file and in `docs/reviews/ia-audit/`. When PPM returns, bookkeeping catches up retroactively. |
| **C9** | Scope is `/app/*` only | Any page outside `/app/*` noted by an auditor goes in the cross-refs section, NOT the scorecard table. |
| **C10** | All-access audit frame | Owner has directed that all personas are assumed to have access to all pages during the audit. Zone assignment is purely semantic. Tier gates are out of scope. |

## 5. Zone model

YCM uses the canonical three-zone split from playbook §2.1, scoped to `/app/*`.

### Zone 1 — Day-to-day association operations

**Intent.** What a property manager or board member opens YCM to do: check association health, process payments, file work orders, communicate with residents, run governance decisions.

**Visual treatment.** Biggest sidebar weight. Shown under the active association's context. Always expanded when an association is selected.

**Traffic pattern.** High repeat, frequently daily during business hours.

**Primary personas (semantic, not enforced).** `manager`, `board-admin`, `viewer` — everyone who runs an association day-to-day.

### Zone 2 — Setup, reference, and account settings

**Intent.** Configure an association, look up a reference document, manage one's own account. Task-driven visits, not daily return traffic.

**Visual treatment.** Secondary weight. Candidates for a lower sidebar section, a collapsed "Settings" drawer, or a separated footer grouping.

**Traffic pattern.** Task-driven, bursty during onboarding and rare thereafter.

**Primary personas.** Same as Zone 1, plus onboarding flows.

### Zone 3 — Platform operator admin

**Intent.** YCM's own team running the platform across associations: platform config, feature toggles, AI ingestion, admin user management, roadmap tracking, executive dashboards.

**Visual treatment.** Hidden from non-operator personas by default. Currently enforced by `roles: ["platform-admin"]` in `app-sidebar.tsx:183-190`. That is the floor; Phase 5 may recommend hardening (dedicated subroute, subdomain, or separate shell).

**Traffic pattern.** Operator team only.

**Primary persona.** `platform-admin`. Any `/app/*` page whose primary persona is `platform-admin` belongs in Zone 3 by playbook §4.2. Any Zone-3 category page whose primary persona is `manager` or `board-admin` is a placement defect to be flagged.

**Hard rule (C1).** Zone 3 is invisible by default. Current gating is the minimum floor.

## 6. Page taxonomy — YCM-derived (13 categories)

Derived via playbook §3.3 from the problem statement above and the observable nav structure. Every `/app/*` page gets exactly one tag. Categories are stable and locked at Phase 0; any drift in Phase 1 is a re-dispatch signal.

### Zone 1 — Day-to-day (7 categories)

| # | Category | Scope |
|---|---|---|
| Z1-1 | **Command Center** | At-a-glance cross-association or cross-portfolio state. The first thing a user sees when logging in. Candidates: `dashboard.tsx`, `portfolio.tsx`, `operations-dashboard.tsx`, `executive.tsx` (if Zone 1 — likely Zone 3), `board.tsx` (if Zone 1 — ambiguous). |
| Z1-2 | **Residents & Units** | Managing people, units, and resident/owner records within an association. Candidates: `units.tsx`, `persons.tsx`, possibly `new-association.tsx`. |
| Z1-3 | **Financial Operations** | Billing, collections, payments, expenses, financial reporting. Candidates: `financial-foundation.tsx`, `financial-billing.tsx`, `financial-payments.tsx`, `financial-expenses.tsx`, `financial-reports.tsx` + 8 legacy financial files if not killed. |
| Z1-4 | **Governance & Decisions** | Board activities: meetings, elections, compliance, decision-making. Candidates: `governance.tsx`, `board.tsx`, `meetings.tsx`, `elections.tsx`, `election-detail.tsx`, `election-ballot.tsx`, `board-packages.tsx`, `governance-compliance.tsx`. |
| Z1-5 | **Communications** | Outbound announcements and inbound / conversational resident channels. Candidates: `communications.tsx`, `announcements.tsx`. |
| Z1-6 | **Service & Maintenance** | Operational work orders, maintenance schedules, inspections, vendor coordination, resident feedback loop. Candidates: `work-orders.tsx`, `maintenance-schedules.tsx`, `inspections.tsx`, `vendors.tsx`, `resident-feedback.tsx`. |
| Z1-7 | **Community & Amenities** | Amenity booking and community engagement surfaces reachable by logged-in operators. Candidates: `amenities-admin.tsx`, `community-hub.tsx`. The resident-facing `amenities.tsx` and `community-hub-public.tsx` are out of scope (not under `/app/*` in their reachable route). |

### Zone 2 — Setup, reference, account (3 categories)

| # | Category | Scope |
|---|---|---|
| Z2-1 | **Association Setup** | Creating, switching, and configuring associations and the workspace's active context. Candidates: `associations.tsx`, `new-association.tsx`, `association-context.tsx`. |
| Z2-2 | **Document Vault** | Reference documents and insurance records. Candidates: `documents.tsx`, `insurance.tsx`. **Note:** Insurance is a candidate for Z2-2 OR Z1-3 (financial operations) OR Z1-6 (service). Audit will decide. |
| Z2-3 | **Account & Help** | Personal user settings and self-service help. Candidates: `user-settings.tsx`, `help-center.tsx`. |

### Zone 3 — Platform operator (3 categories)

| # | Category | Scope |
|---|---|---|
| Z3-1 | **Platform Configuration** | Feature toggles, platform-level controls, AI ingestion, webhooks — anything that changes platform behavior. Candidates: `platform-controls.tsx`, `ai-ingestion.tsx`. |
| Z3-2 | **Platform Team Ops** | Operator-only tooling: admin user management, internal roadmap, executive view. Candidates: `admin-users.tsx`, `roadmap.tsx`, `executive.tsx`. |
| Z3-3 | **Platform Diagnostics** | Debug / preview / internal-only surfaces. Candidates: `workspace-preview.tsx`, `board-portal.tsx` (if truly internal). |

### Notes on splits and ambiguities

- **Executive** (`executive.tsx`) could fit Z1-1 (Command Center) if it's a customer-facing exec view, or Z3-2 (Platform Team Ops) if it's a YCM-internal cross-customer view. Auditor must read the page to decide.
- **Board** (`board.tsx`) could fit Z1-1 (Command Center for a single board) or Z1-4 (Governance). Auditor decides.
- **Insurance** is deliberately listed in Z2-2 as primary but may belong in Z1-3 or Z1-6 — auditor decides.
- **`community-hub.tsx` vs `community-hub-public.tsx`**: the first is `/app/community-hub` (operator-facing, Z1-7), the second is `/community/:identifier` (public resident-facing, OUT OF SCOPE). Both files live in `client/src/pages/` but only one is in the audit.
- **`amenities.tsx` vs `amenities-admin.tsx`**: `/app/amenities` route → `AmenitiesAdminPage`. Resident-facing `AmenitiesPage` only reachable from `/portal/amenities`. Audit scope covers `amenities-admin.tsx`. `amenities.tsx` goes in cross-refs.

### Hard rule: no drift

Phase 1 auditors who find pages that don't fit these 13 categories must flag the page in the cross-refs section and report back, NOT invent a new category. Taxonomy revision requires owner sign-off and a re-lock at Phase 0.

## 7. Primary persona list — YCM

| Tag | Description | Zone implication |
|---|---|---|
| `platform-admin` | YCM operator team. | → Zone 3 always. |
| `manager` | Property manager. Full admin within assigned association scope. Primary customer. | → Zone 1 or 2. |
| `board-admin` | Association board member with admin rights. Primary customer. | → Zone 1 or 2. |
| `viewer` | Association board member with read-only access. Secondary customer. | → Zone 1 or 2 (read-focused surfaces). |
| `automation` | Non-human: AI ingestion, bootstrap payloads, structured exports. | → Zone 3 (AI ingestion) or flagged cross-ref. |
| `owner-resident` | Unit owner or renter. Out of scope — lives at `/portal`. Any `/app/*` page tagged here is a placement defect. | → cross-ref, flag as wrong-surface. |
| `vendor` | Service provider. Out of scope — lives at `/vendor-portal`. | → cross-ref, flag as wrong-surface. |

**Consistency rule.** Per playbook §4.2: `platform-admin` ⇒ Zone 3 always. Also: `owner-resident` or `vendor` in `/app/*` ⇒ wrong-surface flag in cross-refs, not a scorecard verdict (the page simply shouldn't be in the audited surface).

## 8. Scoring rubric

**Copied verbatim from playbook §6. No modifications.** Each audited page returns:

| # | Dimension | Values |
|---|---|---|
| 1 | Purpose | Free text, ≤140 chars, `"This page exists to {verb} {object}."` |
| 2 | Primary persona | One tag from §7 |
| 3 | Category | One tag from §6 |
| 4 | Zone | `zone-1` / `zone-2` / `zone-3` |
| 5 | Placement fit | `correct` / `wrong-section` / `wrong-side` / `wrong-zone` |
| 6 | Content fulfillment | `complete` / `thin` / `broken` |
| 7 | Consolidation candidacy | One verdict from §9 |
| 8 | Cognitive load | `low` / `med` / `high` |

Plus:
- **Gaps** (free-text bullets) required for every `thin` or `broken` page.
- **Goal alignment note** — which §2 goal or §1 symptom bullet the page advances. Pages advancing none default to `KILL` or `DEMOTE-ADMIN`.

## 9. Verdict vocabulary

**Copied verbatim from playbook §7. No modifications.** One verdict per page from this closed set:

`KEEP` · `PATCH` · `MERGE-AS-TAB` · `MERGE-INTO-HUB` · `WIDGETIZE` · `RENAME-MOVE` · `DEMOTE-ADMIN` · `ORPHAN-SURFACE` · `KILL`

**Required metadata.** Every non-`KEEP` verdict requires a **target** and a **one-sentence rationale**.

**Precedence.** `KILL` > `DEMOTE-ADMIN` > `WIDGETIZE` > `MERGE-INTO-HUB` > `MERGE-AS-TAB` > `RENAME-MOVE` > `PATCH` > `KEEP`.

## 10. Phased execution plan

### Phase 0 — this spec

**Output:** this file. **Sub-agents:** 0. **Gate:** owner acceptance before Phase 1 dispatch.

### Phase 1 — Pass 1 auditors (Zones 1 + 2)

**Sub-agent count:** 8 parallel section auditors, one per sidebar section (and adjacent pages). Scope split:

| # | Auditor | Section / pages |
|---|---|---|
| A1 | **Overview & Context** | `dashboard.tsx`, `portfolio.tsx`, `associations.tsx`, `association-context.tsx`, `new-association.tsx` |
| A2 | **Residents & Units** | `units.tsx`, `persons.tsx` |
| A3 | **Finance** | `financial-foundation.tsx`, `financial-billing.tsx`, `financial-payments.tsx`, `financial-expenses.tsx`, `financial-reports.tsx`, `financial-budgets.tsx`, `financial-utilities.tsx`, `financial-recurring-charges.tsx`, `financial-reconciliation.tsx`, `financial-invoices.tsx`, `financial-late-fees.tsx`, `financial-ledger.tsx`, `financial-assessments.tsx` (13 pages — at the §8 upper bound of ~20/auditor; acceptable) |
| A4 | **Board, Governance & Comms** | `board.tsx`, `governance.tsx`, `governance-compliance.tsx`, `meetings.tsx`, `elections.tsx`, `election-detail.tsx`, `election-ballot.tsx`, `board-packages.tsx`, `communications.tsx`, `announcements.tsx` (10 pages) |
| A5 | **Documents & Insurance** | `documents.tsx`, `insurance.tsx` |
| A6 | **Operations & Service** | `operations-dashboard.tsx`, `work-orders.tsx`, `maintenance-schedules.tsx`, `inspections.tsx`, `vendors.tsx`, `resident-feedback.tsx` (6 pages) |
| A7 | **Community & Amenities** | `amenities-admin.tsx`, `community-hub.tsx` |
| A8 | **Account & Help** | `user-settings.tsx`, `help-center.tsx` |

**Out-of-scope files** (not assigned to any Pass 1 auditor — either Zone 3, not `/app/*`, or to be handled by Phase 2 orphan sweep): `platform-controls.tsx`, `admin-users.tsx`, `executive.tsx`, `roadmap.tsx`, `ai-ingestion.tsx`, `workspace-preview.tsx`, `board-portal.tsx`, `amenities.tsx`, `community-hub-public.tsx`, `vendor-portal.tsx`, `owner-portal.tsx`, `landing.tsx`, `pricing.tsx`, `solutions.tsx`, `plan-signup.tsx`, `plan-signup-success.tsx`, `privacy-policy.tsx`, `terms-of-service.tsx`, `onboarding-invite.tsx`, `not-found.tsx`.

**Per-auditor output:** `docs/reviews/ia-audit/pass-1-<section-slug>.md` — one scorecard table, plus DEMOTE-ADMIN handover section and cross-refs section.

**Canonical concat:** `docs/specs/ia-audit-phase1-scorecards.md` — produced by driving agent after all 8 auditors return.

### Phase 2 — Orphan sweep

**Sub-agent count:** 1. **Critical first step:** re-list `client/src/pages/*.tsx` from disk at phase start (do NOT trust this spec's Appendix B). Every file not covered by Phase 1 and not out-of-scope gets a verdict. Expected volume: 15-20 files.

**Output:** `docs/specs/ia-audit-phase2-orphans.md`.

### Phase 3 — Reconciliation (customer side)

**Sub-agent count:** 1 (may be main thread). **Output:** `docs/specs/ia-audit-phase3-reconciliation.md` — proposed Zone 1+2 nav tree, new-hub list, DEMOTE-ADMIN handover list for Phase 4.

### Phase 4 — Pass 2 auditor (Zone 3)

**Sub-agent count:** 1. **Input:** `platform-controls.tsx`, `admin-users.tsx`, `roadmap.tsx`, `ai-ingestion.tsx`, `executive.tsx`, `workspace-preview.tsx`, `board-portal.tsx`, + Phase 3 DEMOTE-ADMIN handovers.

**Output:** `docs/specs/ia-audit-phase4-platform.md`.

### Phase 5 — IA restructure proposal

**Sub-agent count:** 1 (may be main thread). **Output:** `docs/specs/ia-audit-proposal.md` — complete nav tree, per-page action list, new hub stubs, renames, kills with triplet-rule (C2) notes, open implementation questions, risk section.

**GATE:** Owner review. **No Phase 6 work without explicit acceptance.**

### Phase 6 — Execute

Deferred. Executed across multiple sessions following project conventions (branch per migration dependency group, PR review, CI).

## 11. Auditor dispatch template (filled for YCM)

```
You are the IA auditor for section "{SECTION_NAME}" of Your Condo Manager's
/app/* workspace (the admin/operator surface).

Context files to read (and ONLY these):
- docs/specs/ia-audit-spec.md — especially §5 zones, §6 taxonomy,
  §7 personas, §8 rubric, §9 verdicts
- client/src/components/app-sidebar.tsx — current nav definition
- client/src/App.tsx — route map (note: RouteRedirect entries around
  lines 270-292 route legacy paths into hubs; files still exist on disk)
- Each page file listed below

Your scope:
- Pages to audit: {PAGE_LIST}
- Include deep sub-routes of your assigned pages
- Do NOT audit pages outside your assigned section
- Do NOT move, rename, or modify any files
- Do NOT audit pages outside /app/* — /portal, /vendor-portal, /community,
  /signup, /, /pricing, /solutions, /privacy-policy, /terms-of-service are
  all out of scope for this run

Your task:
1. For each page, read it shallowly (component tree + data fetched, not
   every line of JSX).
2. Fill the §8 scorecard: purpose, primary persona, category, zone,
   placement fit, content fulfillment, consolidation candidacy,
   cognitive load.
3. Return a verdict from §9. Every non-KEEP verdict needs a target +
   one-sentence rationale.
4. For any page with content_fulfillment `thin` or `broken`, list
   specific gaps in a bullet field.
5. If a page belongs in Zone 3 (platform operator), mark DEMOTE-ADMIN
   and list it in the handover section at the end of your output.
6. Note cross-section concerns in the cross-refs section — do NOT create
   scorecard rows for pages outside your section.

Your output:
- A single markdown file at docs/reviews/ia-audit/pass-1-{section-slug}.md
- Scorecard table (one row per page, all 8 rubric dimensions + verdict +
  target + rationale + gaps)
- DEMOTE-ADMIN handover section (may be empty)
- Cross-refs section (may be empty)
- Do NOT propose a new nav structure — that is Phase 3's job

Anti-patterns (re-dispatched if violated):
- Multi-tagging categories → pick one
- Verdicts without targets → every non-KEEP needs a target
- Scope creep into neighboring sections → cross-refs only
- Inventing new verdicts or categories → use §6 and §9 only
- Writing a verdict before writing the purpose sentence
- Calling KEEP because it's familiar — KEEP means `correct` + `complete`
  on every dimension

Hard rules:
- C1: Zone 3 is invisible by default. Any page that looks platform-operator-
  only gets DEMOTE-ADMIN regardless of current nav placement.
- C2: If you tag a KILL verdict, name the API routes in server/routes.ts
  affected (or say "unknown — flag for Phase 5") in your rationale.
- C6: Pages only reachable via a <RouteRedirect> are KILL candidates only
  if their content is covered by the redirect target. Otherwise
  ORPHAN-SURFACE.
- C9: /app/* only. Cross-refs for anything else.
- C10: Audit from a semantic persona POV. Assume all-access — do NOT
  use role-gating as justification for any verdict.

Return the full scorecard table by writing the output file. Report back
with the file path and a one-paragraph summary.
```

## 12. Open questions (deferred to later phases)

1. **How is Zone 3 gated post-audit?** Current sidebar-role-filter is the floor. Phase 5 decides whether to recommend a separate admin subroute (`/admin/*`), a subdomain, a separate shell, or hardening of the sidebar filter + adding a middleware equivalent in `server/routes.ts`.
2. **Legacy financial file disposition.** Phase 2 confirms whether hub content fully covers the 8 legacy financial pages' content. If yes → `KILL` (with C2 API coordination). If no → `ORPHAN-SURFACE` with a target hub that needs a patch.
3. **Legacy governance file disposition.** Same question for `governance-compliance`, `meetings`, `board-packages`, `elections`, `election-detail`, `election-ballot`. Note: `/app/governance/elections/:id` is still live-routed to `ElectionDetailPage`, so `election-detail.tsx` is NOT orphan. Phase 1 A4 must check this.
4. **Owner Portal link in Platform Controls.** Current placement (`app-sidebar.tsx:185`) puts `/portal` in an operator menu. Is it a launcher shortcut that should move (Phase 5 decides target) or remove?
5. **Single-association-board UX vs multi-association UX.** `isSingleAssociationBoardExperience()` in `app-sidebar.tsx:215-217` already hides Portfolio + Associations for board-admins with ≤1 association. Phase 5 decides whether this collapse is congruent with the new zone model.
6. **Does `/app/admin/users` move to Zone 3 category Z3-2 or stay as a standalone Zone 2 "Account Admin" page?** Depends on whether it manages YCM's operator users or an association's board users. Phase 4 decides.
7. **URL contracts.** Are any `/app/*` URLs linked from external places (partner sites, email templates, docs)? Answer needed before Phase 6 to scope redirects.

---

## Appendix A — Current nav dump (as of 2026-04-11)

Source: `client/src/components/app-sidebar.tsx`. Reachable routes from `client/src/App.tsx` lines 237-307.

### Overview (always visible, role-filtered)
- **Dashboard** → `/app` → `dashboard.tsx`
- **Portfolio** → `/app/portfolio` → inline page at App.tsx:300 [platform-admin, board-admin, manager, viewer]
- **Associations** → `/app/associations` → inline page at App.tsx:242

### Association workspace (shown under active association)
- **Buildings & Units** → `/app/units` → `units.tsx` [platform-admin, board-admin, manager]
  - People → `/app/persons` → `persons.tsx` [same]
- **Finance** → `/app/financial/foundation` → `financial-foundation.tsx` [all 4 roles]
  - Billing → `/app/financial/billing` → `financial-billing.tsx`
  - Payments → `/app/financial/payments` → `financial-payments.tsx`
  - Expenses → `/app/financial/expenses` → `financial-expenses.tsx`
  - Reports → `/app/financial/reports` → `financial-reports.tsx`
- **Board** → `/app/board` → `board.tsx` [all 4 roles]
  - Governance → `/app/governance` → `governance.tsx`
  - Communications → `/app/communications` → `communications.tsx`
  - Announcements → `/app/announcements` → `announcements.tsx` [platform-admin, board-admin, manager]
- **Documents** → `/app/documents` → `documents.tsx` [all 4 roles]
- **Insurance** → `/app/insurance` → `insurance.tsx` [all 4 roles]
- **Operations** → `/app/operations/dashboard` → `operations-dashboard.tsx` [all 4 roles]
  - Work Orders → `/app/work-orders` → `work-orders.tsx`
  - Maintenance → `/app/maintenance-schedules` → `maintenance-schedules.tsx` [platform-admin, board-admin, manager]
  - Inspections → `/app/inspections` → `inspections.tsx` [platform-admin, board-admin, manager]
  - Vendors → `/app/vendors` → `vendors.tsx`
  - Feedback → `/app/resident-feedback` → `resident-feedback.tsx`
- **Amenity Booking** → `/app/amenities` → `amenities-admin.tsx` [all 4 roles]
- **Community Hub** → `/app/community-hub` → `community-hub.tsx` [all 4 roles]

### Platform (platform-admin only)
- **Platform Controls** → `/app/platform/controls` → `platform-controls.tsx` [platform-admin]
  - Owner Portal → `/portal` → `owner-portal.tsx` ⚠️ *out-of-scope surface linked from operator menu*
  - Admin Roadmap → `/app/admin/roadmap` → `roadmap.tsx`
  - AI Ingestion → `/app/ai/ingestion` → `ai-ingestion.tsx` *(WIP-gated)*

### User (footer)
- **Settings** → `/app/settings` → `user-settings.tsx`
- **Help Center** → `/app/help-center` → `help-center.tsx`
- **New Association** button → `/app/new-association` → `new-association.tsx` *(platform-admin only)*

### Legacy redirect routes (targets in App.tsx:270-292)
Not in the sidebar but still live as redirects:
- `/app/financial/fees|recurring-charges|ledger|assessments|late-fees|invoices|utilities|budgets|reconciliation` → collapsed into `foundation|billing|expenses|reports`
- `/app/governance/board-packages|meetings|compliance|elections` → `/app/governance`
- `/app/admin` → roadmap; `/app/admin/users` → `admin-users.tsx`; `/app/admin/executive` → `executive.tsx`

**Total live nav items:** ~29 (per §1 bullet 1). Plus 9 legacy redirect URLs.

## Appendix B — Orphan candidates (snapshot 2026-04-11)

Pages under `client/src/pages/*.tsx` with no live route from `app-sidebar.tsx` (i.e. only reachable via `<RouteRedirect>` or never routed at all). Phase 2 MUST re-list from disk at phase start — this is a snapshot hint, NOT authoritative.

### Legacy financial (redirect targets — KILL candidates pending content coverage check)
- `financial-budgets.tsx` → redirect to `/app/financial/expenses`
- `financial-utilities.tsx` → redirect to `/app/financial/expenses`
- `financial-recurring-charges.tsx` → redirect to `/app/financial/foundation`
- `financial-reconciliation.tsx` → redirect to `/app/financial/reports`
- `financial-invoices.tsx` → redirect to `/app/financial/expenses`
- `financial-late-fees.tsx` → redirect to `/app/financial/billing`
- `financial-ledger.tsx` → redirect to `/app/financial/billing`
- `financial-assessments.tsx` → redirect to `/app/financial/billing`

### Legacy governance (redirect targets)
- `governance-compliance.tsx` → redirect to `/app/governance`
- `meetings.tsx` → redirect to `/app/governance`
- `board-packages.tsx` → redirect to `/app/governance`
- `elections.tsx` → redirect to `/app/governance`
- `election-ballot.tsx` → possibly linked from `/vote/:token` — A4 auditor checks

**Not orphan** (live-routed but not in sidebar): `election-detail.tsx` is routed at `/app/governance/elections/:id` (`App.tsx:287`).

### Platform admin pages not in primary sidebar
- `admin-users.tsx` → live at `/app/admin/users` but only via direct URL — no sidebar link
- `executive.tsx` → live at `/app/admin/executive` but no sidebar link
- `roadmap.tsx` → live at `/app/admin/roadmap` AND linked from Platform Controls submenu

### Possible zombies
- `workspace-preview.tsx` → no known route
- `board-portal.tsx` → no known route
- `amenities.tsx` → resident-facing, only reachable from `/portal/amenities` (out of scope for `/app/*`)

### Out of scope (Pages file exists but surface is non-`/app`)
- `landing.tsx`, `pricing.tsx`, `solutions.tsx`, `privacy-policy.tsx`, `terms-of-service.tsx`, `plan-signup.tsx`, `plan-signup-success.tsx`, `owner-portal.tsx`, `vendor-portal.tsx`, `community-hub-public.tsx`, `onboarding-invite.tsx`, `not-found.tsx`

## Appendix C — Worked scorecard examples

**Calibration** for Phase 1 auditors. These are illustrative, not pre-verdicts. Auditors should independently reach similar conclusions.

### Example 1 — `financial-budgets.tsx` (KILL candidate)

| # | Dimension | Value |
|---|---|---|
| 1 | Purpose | *"This page exists to plan and track annual association budgets."* (inferred — auditor to verify from file) |
| 2 | Primary persona | `manager` |
| 3 | Category | Z1-3 Financial Operations |
| 4 | Zone | zone-1 |
| 5 | Placement fit | *wrong-section* — file exists but `/app/financial/budgets` route now redirects to `/app/financial/expenses`. Orphan from a prior consolidation pass. |
| 6 | Content fulfillment | `broken` — unreachable from live nav. |
| 7 | Verdict | `KILL` if `financial-expenses.tsx` fully absorbs budget planning; otherwise `ORPHAN-SURFACE` with target `/app/financial/expenses` and a patch required to the expenses hub to add budget tabs. Phase 2 decides. |
| 8 | Cognitive load | — (moot) |
| Gaps | Page is unreachable. Confirm that Expenses hub actually covers budget planning before killing the file. |
| Target (if KILL) | Delete `financial-budgets.tsx`; confirm `/app/financial/budgets` `<RouteRedirect>` in `App.tsx:277` remains for 1 release cycle then removes. C2: check if any API route in `server/routes.ts` was specific to budgets; if so, decide fate. |
| Rationale | Content superseded by Expenses hub; file is residue of partial consolidation. |

### Example 2 — `platform-controls.tsx` (KEEP in Zone 3)

| # | Dimension | Value |
|---|---|---|
| 1 | Purpose | *"This page exists to let YCM operators configure platform-level settings."* |
| 2 | Primary persona | `platform-admin` |
| 3 | Category | Z3-1 Platform Configuration |
| 4 | Zone | zone-3 |
| 5 | Placement fit | `correct` — already sidebar-gated by `roles: ["platform-admin"]`. |
| 6 | Content fulfillment | auditor verifies (likely `complete` or `thin`) |
| 7 | Verdict | `KEEP` if complete; `PATCH` if thin. |
| 8 | Cognitive load | likely `high` |
| Gaps | (none if complete) |
| Target | n/a |
| Rationale | Correctly placed operator-only surface. Hard rule C1 satisfied. |

### Example 3 — `insurance.tsx` (ambiguous — auditor decides)

| # | Dimension | Value |
|---|---|---|
| 1 | Purpose | *"This page exists to..."* — auditor to write from reading file. |
| 2 | Primary persona | `manager` likely |
| 3 | Category | **Disputed.** Z2-2 Document Vault (if it's reference/upload of policy docs) OR Z1-3 Financial Operations (if it tracks premiums, claims, renewals) OR Z1-6 Service & Maintenance (if it relates to claims-as-work). |
| 4 | Zone | depends on category |
| 5 | Placement fit | `wrong-section` if the zone choice makes Insurance a peer of Documents, not Finance or Operations. |
| 6 | Content fulfillment | auditor reads and decides |
| 7 | Verdict | One of: `KEEP` (if current top-level position is defensible), `RENAME-MOVE` (nest under Finance or Documents), `MERGE-AS-TAB` (become a tab under Documents). |
| 8 | Cognitive load | auditor decides |
| Gaps | — |
| Target | depends on verdict |
| Rationale | Depends on reading — this is an illustrative ambiguity example, not a verdict. |

---

## 13. Change log

- **2026-04-11** — draft v0. Initial Phase 0 spec for YCM `/app/*` audit. Taxonomy derived from problem statement + observable nav structure. Zone model is canonical 3-zone. Personas customized for YCM admin roles. Constraints reflect YCM's inline server-side auth + triplet UI/API rule + Drizzle schema stability + Wouter routing. PPM tooling currently offline (C8). Awaiting owner acceptance before Phase 1 dispatch.
