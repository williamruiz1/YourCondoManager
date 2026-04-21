# Phase 12–16 Zone Landing Pattern

**Status:** PATTERN / TEMPLATE (not a spec; codifies existing rules)
**Layer:** 3 (Route / persona gating rollout)
**Owner:** YCM Command Center
**Produced:** 2026-04-20
**Governing sources (do not duplicate — reference):**
- `docs/projects/platform-overhaul/handoffs/3.3-role-gating-corrections-handoff.md` (authoritative zone checklists + Q9–Q12 gates)
- `docs/projects/platform-overhaul/decisions/3.3-role-gating-corrections.md` (SPEC LOCKED)
- `docs/projects/platform-overhaul/implementation-artifacts/phase-9-persona-access-manifest-data.md` (manifest data)
- `docs/projects/platform-overhaul/checklists/zone-landing-q11-checklist.md` (Q11 fill-in)
- Plan `floofy-hopping-dusk.md` §3 (Phases 8a–16), §8 R7 (rollback cascade), §8 R8 (flag hygiene)

---

## Purpose

Phase 12 (Financials) is the first real zone landing. Phases 13 (Operations), 14 (Governance), 15 (Communications), and 16 (Platform) repeat the same structural pattern with zone-specific scope swapped in. This document is the reusable shape so each zone author does not reinvent checklist scaffolding, PR description, or revert-chain etiquette.

Not a spec; no new rules. Every rule here is already locked by 3.3 / 0.2 / 2.x / Plan §8 and cited inline. The 3.3 handoff remains the canonical per-zone checklist source — this doc references it, does not replace it.

---

## Section 1 — Zone landing PR checklist (universal template)

Nine steps per zone PR, in order. Each maps to AC rows in 3.3 and specific plan phases.

1. **Wrap routes with `<RouteGuard>`.** Every route in the zone: `<RouteGuard route="..."><PageComponent/></RouteGuard>`. Consults `shared/persona-access.ts` (Phase 9); returns `<NotFound/>` for denied. AC-Q5-1.
2. **Add breadcrumb paths.** Every page route gets an entry in `client/src/lib/breadcrumb-paths.ts` for the Phase 6 `<Breadcrumb/>` component. Single-file discipline per Plan §Phase 6 — append on conflict.
3. **Apply `useIsReadOnly()` on write actions.** Every Assisted Board write surface (tables, submit buttons, action menus) wires the 2.3 Q7 hook. Viewer always read-only.
4. **Populate `shared/persona-access.ts` entries.** Phase 9 ships the manifest; if a row is missing, inline it in the zone PR cross-referencing `phase-9-persona-access-manifest-data.md`. No invented mappings — every row traces to 0.2 or a 2.x amendment.
5. **Parity tests — three tiers.** Tier 1 exhaustive (zone routes × six personas, AC-Q4-1); Tier 2 happy-path per persona pair (AC-Q4-4); Tier 3 sidebar smoke (ships unchanged from Phase 11, AC-Q4-5).
6. **Fill Q11 checklist.** Copy `checklists/zone-landing-q11-checklist.md` into the PR; fill the three gates: zero 401/403 on permitted routes, zero unguarded access on blocked routes, no net-new console errors vs. `baselines/pre-phase-12-baseline.md`.
7. **Document rollback plan.** Section 4 template has a Rollback block — fill it. For flagged zones (Phase 13's `BOARD_SHUNT_ACTIVE`), flag-flip is lever 1; PR revert is lever 2.
8. **Founder sign-off gate.** William approves before the next zone's PR opens (AC-Q5-3, AC-Q9-3). No exceptions.
9. **Replace `canAccessWipRoute` call sites.** Zone files swap remaining calls for `<RouteGuard>` + `canAccess()`. The WIP allowlist in `client/src/lib/wip-features.ts` retires zone-by-zone; final deletion is a cleanup PR after Phase 16.

---

## Section 2 — Per-zone scope reference

This section is a lookup — one subsection per zone. Detailed persona mapping lives in `phase-9-persona-access-manifest-data.md`; detailed per-route Tier-1 test lists live in the 3.3 handoff's zone blocks. Do not duplicate that content here. This section points to it.

### Phase 12 — Financials

- **Routes:** 20 total — `/app/financials` hub (3.2 Q1) + 5 `/app/financials/*` plural redirects + 5 `/app/financial/*` gating targets + 9 `/app/financial/*` legacy redirects. Manifest rows 2–21; handoff §Zone 1.
- **Components wrapped:** Financials hub (Phase 11 scaffold), Foundation, Billing, Payments, Expenses, Reports. Redirect rows inherit gating from destinations.
- **Persona map:** Manager ✓, Board Officer ✓, Assisted Board ✓ (R), PM Assistant ✓ (T), Viewer ✓ (R), Platform Admin ✓ (flag D1 — see caveats). `useIsReadOnly()` on Assisted Board write actions.
- **Breadcrumbs:** 6 new entries (hub + 5 targets).
- **Quirks:** First real RouteGuard rollout — regressions expected here by design. No feature flag. Consumes Phase 11 hub + Phase 6 breadcrumb infra.

### Phase 13 — Operations

- **Routes:** 10 — `/app/operations` hub (3.2 Q2), `/app/operations/dashboard` (0.1 AC 7 preserved), `/app/operations/records`, `/app/units`, `/app/persons`, `/app/vendors`, `/app/work-orders`, `/app/resident-feedback`, `/app/maintenance-schedules`, `/app/inspections`. Manifest rows 22–24, 38, 39, 50–54.
- **Components wrapped:** Operations hub + nine sub-pages listed above.
- **Persona map:** All operator personas ✓; Assisted Board `(R + triage; T can expand)`; PM Assistant toggle-gated; Viewer read-only (D4 caveat for Maintenance Schedules + Inspections).
- **Breadcrumbs:** 10 new entries.
- **Quirks:** Ships `BOARD_SHUNT_ACTIVE` flag (default `true`, dark-launched). Follow-up PR flips to `false` after one release cycle; later PR deletes flag + shunt code (commit cites `2.3-permission-boundary-corrections.md` per AC-Q6-4). Tier 1 must include Q6 E2E test (`board-officer` reaches `WorkspaceRouter` with flag off). Q11 extended with gate-4 (no session-auth regression on flag flip).

### Phase 14 — Governance

- **Routes:** 10 — `/app/governance` hub (3.2 Q3), `/app/governance/overview` (relocated `GovernancePage`), `/app/governance/elections/:id`, `/app/board`, `/app/documents`, plus 4 governance legacy redirects. Manifest rows 25–31, 42, 43.
- **Components wrapped:** Governance hub, Overview, Elections, Board members list, Documents.
- **Persona map:** All operator personas ✓ full; Viewer ✓ (R) with inline action gate on elections dynamic route — migrate to `useIsReadOnly()` this phase.
- **Breadcrumbs:** 5 landing entries; redirects inherit.
- **Quirks:** Deletes `normalizeAdminRole` (3.3 Step 7). Idempotent SQL migration converts alias rows to canonical values (logs to `role_migration_log`); deletion commit removes `server/routes.ts:778-793`. Adds ESLint rule (or Drizzle check constraint) blocking non-canonical role assignments in `server/`. Q11 extended with gate-4 (zero alias rows in `admin_users.role`). Not PR-revertible alone — restore function from git history; data migration is idempotent.

### Phase 15 — Communications

- **Routes:** 6 — `/app/communications` hub (3.2 Q3), `/app/communications/overview` (relocated `CommunicationsPage`), `/app/communications/inbox` (4.1 Q4 placeholder; activated if 4.1 Session A complete), `/app/announcements`, `/app/community-hub`, `/app/amenities`. Manifest rows 32–34, 57–59.
- **Components wrapped:** Communications hub, Overview, Inbox, Announcements, Community Hub, Amenities.
- **Persona map:** All operator personas ✓; Viewer ✓ (R) except Announcements (Viewer ✗ per 0.2).
- **Breadcrumbs:** 6 new entries.
- **Quirks:** If 4.1 Q1/Q6 resolve by Phase 15 kickoff, inbox activates with Q11 gate-4 (baseline console error count pre/post activation). Otherwise inbox stays a placeholder stub; revert drops to placeholder rather than reverting the whole zone.

### Phase 16 — Platform (atomic bundle)

- **Routes:** All `/app/platform/*`, all `/app/admin/*` (except retired `/app/admin` alias → `NotFound` per 3.2 Q6), all `/app/ai/*`. Manifest rows 44–49.
- **Components wrapped:** Platform Controls, Admin Roadmap, Admin Users, Admin Executive, AI Ingestion. All `<RouteGuard roles={["platform-admin"]}>`.
- **Persona map:** Platform Admin ✓ only; every other persona ✗.
- **Breadcrumbs:** 5 new entries.
- **Quirks:** Atomic Q8 bundle — four surfaces land or revert together: (a) server narrowing of `/api/platform/*`, `/api/admin/*`, `/api/ai/ingestion/*` to `requireAdminRole(["platform-admin"])`; (b) `platformSubPages` tab-bar narrowing at `App.tsx:177-180`; (c) Owner Portal launcher removed from `app-sidebar.tsx:185` + `App.tsx:180`; (d) `<RouteGuard>` on every platform/admin/ai route. Partial revert forbidden per Conflict Class C. Q11 extended with gate-4 (manual revert test on throwaway branch — AC-Q8-6).

---

## Section 3 — Revert chain policy (Plan §8 R7)

Zone landings are serially revert-dependent. **Phase N revert halts Phase N+1** until Phase N re-lands clean.

**Trigger (any of these, per 3.3 Q10):**
- 401/403 on a permitted route for any persona (Q11 Gate 1).
- Unguarded access discovered on a blocked route (Q11 Gate 2).
- Two or more net-new JS console errors vs. baseline (Q11 Gate 3).
- A Tier 1 parity test that passed pre-deploy fails post-deploy in CI.

**Who calls it:** zone PR author surfaces the failure; William signals go/no-go on revert. Not a unilateral call — a declared step.

**Downstream halt:** Phase 12 revert halts Phase 13; Phase 13 halts 14; 14 halts 15; 15 halts 16. "Halt" = next PR does not open (or if already open, does not merge). Fix-forward work on the halted phase may continue in-branch.

**Escalation (AC-Q10-4):** two consecutive zone failures → full pause of all subsequent landings + cross-zone RCA. File a human task; do not open Phase N+2.

**Resume:** (1) revert deployed, (2) post-mortem filed in PPM, (3) fix-forward PR with Q9 + Q11 re-run, (4) zone re-lands passing all three gates, (5) downstream PR re-opens or merges.

**Data-side caveats:**
- Phase 13: `BOARD_SHUNT_ACTIVE=true` is first revert lever; code revert is second.
- Phase 14: `normalizeAdminRole` deletion not PR-revertible alone — restore function from git history; data migration idempotent.
- Phase 16: atomic all-four-surfaces revert; no partial revert.

---

## Section 4 — Sample zone PR template

Zone authors copy-paste this into the PR description and fill the braces.

```
# Phase {N} — {Zone} zone landing

## Scope
- {N} routes wrapped in <RouteGuard> (listed in Section 2 of phase-12-16-zone-landing-pattern.md)
- Breadcrumb paths added to client/src/lib/breadcrumb-paths.ts
- Parity Tier 1/2/3 tests for this zone (tests/parity/{zone}.test.ts)
- useIsReadOnly applied on {X} write actions for Assisted Board

## Manifest rows consumed
Rows {first-last} from phase-9-persona-access-manifest-data.md.

## Q11 observability
See `docs/projects/platform-overhaul/checklists/zone-landing-q11-checklist.md`
filled inline below / linked at {link}.

- Gate 1 (zero 401/403 on permitted): {PASS/FAIL}
- Gate 2 (zero unguarded access on blocked): {PASS/FAIL}
- Gate 3 (no net-new console errors): {PASS/FAIL}
{- Gate 4 (zone-specific, if applicable): {PASS/FAIL}}

Baseline comparison: {within ±5% / outliers noted}.

## Rollback (per 3.3 Q10)
- Revert lever 1: {flag flip if applicable / not applicable}
- Revert lever 2: `git revert {merge SHA placeholder}`
- Post-revert: re-run manual persona smoke across {N} routes × 6 personas.
- Downstream impact: Phase {N+1} halts until restored.

## Downstream impact
- Phase {N+1} ({next zone}) dependent on this landing; will not open PR
  until this one merges + Q11 gates pass + founder sign-off.
- {Optional zone-specific cascade notes, e.g. BOARD_SHUNT_ACTIVE flag flip
  follow-up PR scheduled for release cycle +1.}

## Validation
- [ ] `npm run test` green (all Tiers)
- [ ] `npm run check` clean (TypeScript baseline error count not exceeded)
- [ ] Manual persona smoke per 0.2 matrix (6 personas × {N} routes)
- [ ] Q11 baseline delta within threshold
- [ ] Q12 handoff doc written at docs/overnight/YYYY-MM-DD-{zone}-landing.md
- [ ] Founder sign-off received

## References
- Governing handoff: handoffs/3.3-role-gating-corrections-handoff.md §Zone {N}
- Manifest data: implementation-artifacts/phase-9-persona-access-manifest-data.md
- Pattern doc: implementation-artifacts/phase-12-16-zone-landing-pattern.md
```

---

## Section 5 — Stop-the-line protocol

When a zone PR fails post-merge, the queue halts. No Phase N+1 PR opens until Phase N is fixed or reverted and its Q11 gates pass. Failure signals are the Q10 triggers (Section 3 above). The author announces the failure in PPM, files a human task for William's go/no-go on revert, and does not merge or open any subsequent zone PR until parity is restored. Two consecutive failures escalate to a full queue pause with cross-zone RCA before any resumption. This discipline — serial, gated, explicit — is what prevents RouteGuard/persona misconfigurations from compounding across five zones and producing a state nobody can diagnose.

---

## Caveats flagged for William's reconciliation

Tensions between the 3.3 handoff text and the Phase 9 manifest / plan amendments. None block Phase 12 on their own; surfaced here so zone authors stop and file a human task rather than choosing ad hoc.

1. **D1 — `/app/financial/*` Platform Admin access.** Manifest rows 8–12 show Platform Admin ✓ (sidebar precedent), but 0.2 §Persona 6 says Platform Admin does not own customer association content. Handoff §Zone 1 does not explicitly exclude Platform Admin. Decision needed before Phase 12.
2. **D4 — Viewer on `/app/maintenance-schedules` + `/app/inspections`.** Manifest marks Viewer ✓; current sidebar omits Viewer. Minor sidebar oversight (Part 5 of manifest doc). Phase 13 should reconcile to manifest.
3. **`/app/settings/billing` Platform Admin (A3).** 4.4 Q6 says Manager-only, silent on Platform Admin. Manifest resolves ✗. If Platform Admin needs tenant-billing ops, that belongs on a separate platform surface. Confirm before Phase 16 close.
4. **`/app/communications/inbox` Platform Admin (A2).** 4.1 Q4 lists five personas, not Platform Admin. Manifest extrapolates ✓. Phase 15 activation should confirm or reverse to ✗ before PR opens.
5. **`/app/new-association` Manager access (A7).** Sidebar footer shows button to `platform-admin` only today; Manager needs it for multi-association creation. Manifest resolves Manager ✓ + Platform Admin ✓. Confirm Manager actually reaches this page, or restrict to Platform Admin by design.
6. **`PORTAL_ROLE_COLLAPSE` timing.** Handoff schedules flag removal in Phase 8c, before Phase 12 opens. Plan §8 R8 makes this a merge-blocker. Confirm Phase 8c shipped clean before Phase 12 kickoff; otherwise pause.
