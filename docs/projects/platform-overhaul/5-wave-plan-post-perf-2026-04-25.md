# YCM Platform — Waves 17–21 Plan (post-perf, 2026-04-25)

**Authored:** 2026-04-25 (after Waves 11–16 shipped: Owner Portal Restructure, Phase 8c cleanup, 4.4 Q5–Q7 build, Layer 5 polish, Alert v2 invalidation, Playwright E2E, perf F1/F6/F7).
**SDLC per wave:** scope → spec → implement → review → validate → deploy.

## Paused (needs founder action — agents will not touch)

- **PPM `ea9a9709`** — 4.4 Q5/Q6/Q7 founder confirmations (5 trade-offs).
- **1.5 HV-3** — needs HV-2 soak through ~2026-05-08.
- **Server-side `AdminRole` dedup + `normalizeAdminRole` retirement** — needs prod-data audit on `admin_users.role` (Phase 14).
- **Neon prod password rotation** — manual.

## Waves 17–21

### Wave 17 — Real-backend E2E slice + dev-server fix

**Scope.** PPM `30e60cb6`. Wave 16a shipped Playwright on a static-server fallback because the Mac dev-server has a `reusePort: true` ENOTSUP and there's no ephemeral DB scaffold for tests.
- Fix `server/index.ts` `reusePort: true` Linux-only (mirrors the fix that landed in `script/dev.ts` for macOS).
- Add ephemeral Postgres scaffolding for Playwright (testcontainers-node OR pg-mem OR `docker run -d postgres`-on-demand wrapper). Pick the one that needs no extra system-level deps.
- Migrate one Playwright spec (alerts-lifecycle, the highest-leverage one) from the static-server stub to the real backend so we have at least one true end-to-end-with-real-DB test.
- Document the runner choice in `implementation-artifacts/e2e-test-suite.md` §Wave-17 update.

**Diff target:** ≤1500 LoC.

---

### Wave 18 — Layer 5 deep polish (5.1 + 5.2 + 5.3 round 2)

**Scope.** Wave 14 shipped MVP slices of `<EmptyState>`, `<ErrorState>`, `<ErrorBoundary>`. Now broaden adoption.
- **5.1 EmptyState audit:** sweep the remaining ~40 list/table/feed surfaces. Adopt where missing.
- **5.2 ErrorState audit:** find the call sites still showing raw `error.message`; route through `<ErrorState>` with retry. Add per-route ErrorBoundary granularity (one per zone).
- **5.3 mobile follow-ups:** ship the 5 deferred fixes from Wave 14 (operator table card-fallbacks, header compression, 320px floor, form dialog density, visual regression harness scaffold).

**Diff target:** ≤2500 LoC.

---

### Wave 19 — Perf F2 + F4 + F5

**Scope.** Three remaining perf follow-ups from `5.4-performance-audit.md` §6.
- **F2:** add composite index `assessment_run_log(association_id, run_started_at DESC)` via migration `0014_assessment_run_log_index.sql` (or next-available number after the worktree fetch — verify).
- **F4:** static-asset optimization — compress PNGs/JPEGs in `public/`, add `loading="lazy"` to images that are below-the-fold on Home + portal hubs. Quick wins.
- **F5:** real load-test harness — pick `autocannon` (lightest dep) and add `script/load-test.ts` that hits 5 named endpoints sequentially with N=100 reqs each, prints p50/p95/p99 + error rate. Don't run it; just document how to run.

**Diff target:** ≤1000 LoC.

---

### Wave 20 — Documentation backfills + handoffs

**Scope.** `docs/projects/platform-overhaul/00-index.md` shows several handoff and PPM-card cells reading `_pending_` or `_card file pending_`. Backfill what's outstanding.
- Audit each row in 00-index for `_pending_`. For each, either (a) author the handoff doc / PPM task card stub, or (b) explain why it's no longer needed.
- Architecture doc refresh: a single `architecture.md` that summarizes the current state of the platform after the 22 PRs merged this session.
- API documentation: machine-generated OpenAPI spec from existing zod schemas + route handlers if feasible; otherwise a hand-curated list of every endpoint grouped by zone.

**Diff target:** ≤1500 LoC. Pure docs; no code changes.

---

### Wave 21 — Accessibility audit + i18n scaffolding

**Scope.** Two adjacent quality bars not yet addressed.
- **a11y audit:** top 10 surfaces (Home, central inbox, hub widgets ×4, /app/financial/rules, /portal, /portal/finances, /app/settings/billing). For each: aria-labels on interactive elements, keyboard nav (Tab traversal in correct order), focus-visible outlines. Fix what's missing. Author `implementation-artifacts/a11y-audit-2026-04-25.md` cataloguing findings + fixes.
- **i18n scaffolding:** extract user-visible strings from those 10 surfaces into a `client/src/i18n/strings.en.ts` module. Don't translate yet — establish the pattern. Add a `t()` helper that looks up by key. Document the migration path for the rest of the app.

**Diff target:** ≤1500 LoC.

---

## Dispatch cadence

**Conflict matrix:**
- 17 ↔ 18: no overlap (E2E vs UI components).
- 17 ↔ 19: no overlap.
- 18 ↔ 19: no overlap (UI vs server/migrations).
- 18 ↔ 21: HIGH overlap — both touch `client/src/components/` and `client/src/pages/`.
- 20 ↔ all: minimal overlap (pure docs).

**Plan:**
- **Round 1 (3 agents in parallel):** W17 + W18 + W19.
- **Round 2 (2 agents in parallel after Round 1 merges):** W20 + W21.

## Definition of Done per wave

- Validation gates green (`tsc`, `lint`, `vitest`, `build`).
- PR opened, mergeable CLEAN, squash-merged to main.
- Any deferrals filed as PPM workitems with rationale.
- Worktree cleaned up by parent.

## Stopping rules

- If any wave hits >2x its diff target, agent must split into two PRs and document.
- If any wave needs founder judgment (Q resolution, business trade-off), agent must file PPM human-task and stop, NOT guess.
- If validation gate fails, agent must fix or revert before pushing.
