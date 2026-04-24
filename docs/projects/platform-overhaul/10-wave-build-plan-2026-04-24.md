# YCM Platform — 10-Wave Build Plan (2026-04-24)

**Authored:** 2026-04-24 (post-Session-D lock)
**Sessions locked:** A (4.1), B (4.2 + 4.4 Q4 + 3a amenities), C (4.3), D (1.5 hub-visibility rename)
**Unblocked scope:** Layer 0/1/2/3/4 all locked; ready for build execution.

## Objective

Ship user-visible YCM platform capability by executing the shipped specs. 10 waves covering:
- The cross-association alert engine end-to-end (Waves 2–5)
- The unified assessment execution engine end-to-end (Waves 6–9)
- Amenities per-association toggle (Wave 1)
- Hub-visibility rename foundation (Wave 10)

## Wave catalog

| # | Wave | Spec anchor | Migration | Scope |
|---|---|---|---|---|
| 1 | Amenities toggle (3a) | 4.2 Q3 addendum | `0008_amenities_enabled` | `associations.amenitiesEnabled` column + Manager setting + sidebar conditional + `/portal/amenities` 404-when-disabled |
| 2 | Alert engine foundation | 4.1 Q1/Q5/Q6/Q7 | `0009_alert_read_states` | `alertReadStates` schema + `server/alerts/` module + Tier 1 sources + `canAccessAlert` predicate + `GET /api/alerts/cross-association` endpoint |
| 3 | Alert engine Home surface | 4.1 Q6/Q8 | — | `useCrossAssociationAlerts` hook + Home panel rendering + 120s polling |
| 4 | Central inbox | 4.1 Q4/Q7 | — | `/app/communications/inbox` page + read/dismiss mutations + archived filter |
| 5 | Hub alert widgets | 4.1 Q9 | — | `<HubAlertWidget>` + four hub integrations (Financials/Operations/Governance/Communications) |
| 6 | Assessment schema extensions | 4.3 Q5/Q7 | `0010_assessment_extensions` | `specialAssessments` new columns (interest/term/allocation/payment options) + `assessmentFrequencyEnum` + `unitScopeMode` enum + universal `graceDays`/`startDate`/`endDate` |
| 7 | Unified assessment orchestrator | 4.3 Q3 | `0011_assessment_run_log` | `server/assessment-execution.ts` + `assessmentRunLog` + `ASSESSMENT_EXECUTION_UNIFIED` flag + shadow-write |
| 8 | Consolidated rules UI | 4.3 Q9 | — | `/app/financial/rules` page (three tabs: Recurring / Special Assessments / Run History) + legacy banners on Foundation & Billing |
| 9 | Owner portal assessment detail | 4.3 Q5 | — | `server/assessment-ownership.ts` pure calc module + `GET /api/portal/assessments/:assessmentId/detail` + portal drill-in UI |
| 10 | Hub visibility rename HV-1 | 1.5 HV-1 | `0012_hub_visibility_rename_additive` | Additive `ALTER TYPE ADD VALUE` for the 5 new vocab strings + `HUB_VISIBILITY_RENAME` feature flag (OFF); dual-vocab accepted by read paths |

## Dependency graph

```
Wave 1 ──────────────────────────────────────────> (independent)
Wave 2 ──> Wave 3 ──> Wave 4 ──> Wave 5
Wave 6 ──> Wave 7 ──> Wave 8 ──> Wave 9
Wave 10 ─────────────────────────────────────────> (independent)
```

- **Fan-out set 1 (parallel-safe):** Waves 1, 2, 6, 10 can dispatch concurrently — migration numbers pre-assigned (0008, 0009, 0010, 0012); no file overlap.
- **Fan-out set 2:** Waves 3, 7 after 2 and 6 respectively.
- **Sequential after that:** Waves 4, 5 on alerts path; Waves 8, 9 on assessments path.

## PR discipline (per wave)

- Branch: `wave/{NN}-{short-slug}` off `main`.
- Each wave = 1 PR unless explicitly split.
- Acceptance gates per wave: `npm ci`, `npm run check` (tsc), `npm run lint`, `npx vitest run`, `npm run build` — all must pass.
- Migration number is pre-assigned (see table) to avoid concurrent-PR conflicts.
- PR body references its spec anchor and enumerates which AC rows of that spec it satisfies.
- Wave 10 + subsequent HV-2/HV-3 are split across multiple PRs per 1.5's 3-phase plan.

## Backlog (beyond the 10 waves)

Filed for future execution, not started in this cycle:
- 4.1 Tier 2 sources (vendor renewals, insurance expiry, budget variance, late fees)
- 4.3 PM toggle `assessment_rules_write` + Assisted Board write path
- 4.3 unified on-demand `POST /api/financial/rules/:ruleId/run` with dryRun
- 4.3 5.1 cleanup (retire legacy per-subsystem endpoints + deprecated exec functions)
- 3.5 Owner Portal Restructure (full mega-file split)
- 3.5 / 4.2 Q6 sidebar vocabulary migration (bundled with 3.5)
- 4.4 Q5/Q6/Q7 (trial model, upgrade paths, remaining session-continuity)
- Phase 0 billing-migration initiative (4.4 Q4 deferral)
- 1.5 HV-2 (backfill + dual-read + per-association flip)
- 1.5 HV-3 (enum recreate + recast + flag removal)
- Phase 8a/8b/8c (AdminRole dedup + PortalRequest retype — Layer 2 primitives)
- Phase 11 + Phase 12–16 zone landings
