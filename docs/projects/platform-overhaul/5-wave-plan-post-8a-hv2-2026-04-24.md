# YCM Platform — 5 Large Wave Plan (post-Phase 8a + HV-2, 2026-04-24)

**Authored:** 2026-04-24 (after PR #37 HV-2 + PR #38 Phase 8a merged)
**Previous plan:** `10-wave-build-plan-2026-04-24.md` — all 10 waves delivered.
**SDLC per wave:** scope → spec (if pending) → implement → review → validate → deploy.

## Context

All Layer 0–4 modules SPEC LOCKED. 10 build waves shipped. Phase 8a + 8b collapse shipped. 1.5 HV-1 + HV-2 shipped. 4.3 unified on-demand + PM toggle shipped. 4.1 alert engine (Tier 1 + Tier 2 sources) + Home panel + central inbox + hub widgets shipped. Amenities toggle shipped. Owner portal assessment-detail surface shipped.

**Left on the table:**
- 3.5 Owner Portal Restructure BUILD (spec locked; ~800-line mega-file split into PortalShell + 8 zones + legacy compat)
- Phase 8c (client-side AdminRole dedup + final flag removal)
- 5.x polish (empty/error states, mobile, performance — all four Layer 5 modules QUEUED)
- 4.4 Q5/Q6/Q7 spec + build (trial model, upgrade paths, post-checkout continuity)
- 1.5 HV-3 (enum-recreate + retire old values; requires HV-2 soak)
- 4.1 polish: real-time invalidation wiring, Tier 3 notifications, E2E coverage
- Legacy cleanups: retire Phase 8b deprecated middlewares, 4.3 legacy per-subsystem endpoints, Foundation/Billing banners

## The 5 Waves

### Wave 11 — Owner Portal Restructure (3.5 BUILD)

**Scope:** deliver the 3.5 spec (PR #31 locked 2026-04-24). Replace `client/src/pages/owner-portal.tsx` mega-file with `PortalShell` + 8 zone files + sub-page route tree + legacy-URL compat layer. Big-bang migration in one PR (with a small precursor setup PR for PortalShell scaffolding if agent judges it safer).

**SDLC:**
- **Scope:** read `decisions/3.5-owner-portal-restructure.md`, `handoffs/3.5-owner-portal-restructure-handoff.md`, audit current `owner-portal.tsx` tabs + data flows.
- **Spec:** already locked; no Q resolution needed.
- **Implement:** PortalShell + 8 zone files under `client/src/pages/portal/`, route wiring in App.tsx, legacy compat layer `/portal?tab=<legacy>` → redirect, deletion of `owner-portal.tsx`.
- **Review:** second-pass self-review diff; ensure all 7 current tabs have homes in the new structure; session gate is shell-owned; no route-level persona branching (post-Session-B-Q2 collapse).
- **Validate:** `npm ci`/`check`/`lint`/`vitest run`/`build` all green.
- **Deploy:** squash-merge to main.

**Precursor gate:** ensures legacy email links in production data (if any grep hits from outbound templates) are supported by the compat layer.

**Risk:** highest of the five — 7 tabs × existing portal UX must render correctly post-migration.

**Est. diff:** ~2000–3000 LoC.

---

### Wave 12 — Phase 8c + 5.1 Legacy Cleanup

**Scope:** finish the Phase-8 layer-2-primitives bundle and sweep 5.1 legacy endpoints.

**Contents:**
- Client-side `AdminRole` dedup: remove 8 local declarations scattered across `client/src/` per phase-8 call-site audit; all import from `shared/schema`.
- `normalizeAdminRole` alias cleanup: retire after grep confirms zero call sites.
- Retire Phase 8b `@deprecated` middlewares `requirePortalBoard` + `requirePortalBoardReadOnly`.
- Retire 4.3 legacy per-subsystem run endpoints (`POST /api/financial/recurring-charges/run` and `POST /api/financial/assessments/run`) → remove the shim wrappers.
- Remove Foundation + Billing legacy banners pointing to `/app/financial/rules` (one release cycle after Wave 8).
- Delete Wave 7 `@deprecated` execution functions (`runDueRecurringCharges`, `processSpecialAssessmentInstallments`) — replace callers with the unified orchestrator.

**Prerequisite:** Wave 11 must merge first (3.5 restructure deletes `owner-portal.tsx` — if Wave 12 ran first, it'd conflict with the file deletion).

**Risk:** medium — retiring endpoints + functions needs careful grep. Mitigated by the existing test suite.

**Est. diff:** ~600–1000 LoC (mostly deletions).

---

### Wave 13 — 4.4 Q5/Q6/Q7 Spec Lock + Build

**Scope:** lock the three remaining 4.4 questions and ship the implementation.

- **Q5 trial model:** 14-day trial (currently live); decide on soft-lock vs hard-lock post-trial; free-tier? Grace period length. UI display (Home banner vs sidebar badge vs settings).
- **Q6 upgrade/downgrade paths:** in-app plan-change surface vs Stripe Customer Portal-only. Where does billing management live for Manager (currently `/app/platform/controls` which is Platform Admin only). Self-managed → property-manager upgrade trigger.
- **Q7 post-checkout session continuity:** Part 1 already shipped (`/api/public/signup/complete` auto-auth in PR #10). Remaining: Google OAuth session persistence through Stripe redirect, `/signup/success` → `/app` landing state.

**SDLC:**
- **Scope:** read `decisions/4.4-signup-and-checkout-flow.md`, current signup/checkout code.
- **Spec:** present Q5/Q6/Q7 tradeoffs, resolve each (founder decisions required — agent should draft PENDING resolutions with recommendations).
- **Implement:** trial-state UI banner, upgrade-path surface, session continuity shim.
- **Review/Validate/Deploy:** standard.

**Risk:** medium — touches live Stripe integration; no schema changes expected.

**Est. diff:** ~800–1500 LoC.

---

### Wave 14 — Layer 5 Polish & Hardening (5.1–5.4)

**Scope:** deliver the four Layer 5 modules that are currently QUEUED.

- **5.1 Empty states:** consistent empty-state pattern across every list/table. Audit all surfaces. New `<EmptyState>` shared component.
- **5.2 Error states:** consistent error-boundary + fallback UX. Standardize error messages. Add error-tracking integration hooks.
- **5.3 Mobile audit:** every surface tested at 375px and 768px. Fix any breaking layouts per `docs/projects/mobile-ui-rules.md`.
- **5.4 Performance audit:** bundle analysis, TanStack Query cache audit, server-side p95 measurement on top 10 endpoints, image optimization.

**SDLC per sub-module:** scope → spec → implement → review → validate → deploy.

**Risk:** low per individual change; high coordination overhead (lots of small surfaces). Splits cleanly into 4 sub-PRs.

**Est. diff:** ~1500–2500 LoC cumulative.

---

### Wave 15 — Alert engine v2 + 1.5 HV-3 + E2E test expansion

**Scope:** three strongly independent sub-tracks; agent may split into sub-PRs.

- **4.1 alert engine v2:**
  - Real-time cache invalidation wiring: every WO/election/ledger/document/vendor/insurance/budget write calls `invalidateAlertCache()`.
  - Tier 3 notifications (push) — new spec deferred from 4.2 Q2 DEFER; scoped as opt-in follow-up if time permits.
- **1.5 HV-3:** retire old `hub_visibility_level` enum values via enum-recreate + column-recast migration. Remove `HUB_VISIBILITY_RENAME` flag. Remove old-vocab code paths from `shared/hub-visibility.ts` + client `visibilityLabels` map. Gated by HV-2 having soaked ≥ 2 weeks in production with zero old-vocab writes (operator runs query, confirms before agent ships).
- **E2E test suite:** Playwright or Vitest Browser-mode. Cover: signup → workspace onboarding → invite user, alerts lifecycle (raise → read → dismiss → restore on Home/inbox/hub), assessment lifecycle (rule create → run → ledger verify), owner portal navigation through all 8 zones, amenities toggle off/on round-trip.

**Risk:** medium — HV-3 touches pg enum recreate which blocks writes briefly. Must coordinate with operator.

**Est. diff:** ~2000 LoC across sub-tracks.

---

## Agent Dispatch Strategy

**Constraint:** 2 agents in parallel. Some waves have file-conflict dependencies.

**Conflict matrix:**
- Wave 11 conflicts with Wave 12 (Wave 11 deletes `owner-portal.tsx`; Wave 12 cleans up legacy endpoints — routes.ts overlap).
- Waves 13, 14, 15 have minimal overlap with each other and with Wave 11.

**Recommended dispatch:**
- **Round 1 (2 agents parallel):** Wave 11 (biggest, start first) + Wave 13 (independent spec + build).
- **Round 2 (2 agents):** Wave 12 (after Wave 11 merges) + Wave 14 (mobile/empty/error/perf).
- **Round 3 (single agent):** Wave 15 (HV-3 needs HV-2 soak; E2E likely last).

## SDLC Checklist (applied per wave)

| Phase | Definition of Done |
|---|---|
| **Scope** | Agent reads anchor spec + handoff + any call-site audits. Lists files touched. |
| **Spec** | If PENDING Qs exist, agent drafts resolutions with recommendations. If spec is locked, skip. |
| **Implement** | Code + tests; keep diff under stated bound; follow existing patterns. |
| **Review** | Self-diff review; ensure no untouched specs are violated; verify no TODO comments left. |
| **Validate** | `npm ci` / `npm run check` / `npm run lint` / `npx vitest run` / `npm run build` — all green. |
| **Deploy** | Squash-merge to main via `gh pr merge <N> --squash` if mergeable CLEAN. |

## Post-wave expectations

- Test count grows by 20–60 per wave.
- Main stays deployable after every merge.
- Tasks filed as PPM workitems via `ppm_workitem_create` for any spillover.
- Any blocker requiring user action → `ppm_human_task_create` per PPM protocol.
