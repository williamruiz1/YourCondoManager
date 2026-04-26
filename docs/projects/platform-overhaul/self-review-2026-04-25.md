# Platform Overhaul — Self-Review 2026-04-25

**Snapshot date:** 2026-04-25 (post-Wave 33 / pre-Wave 35b).
**Author:** Claude Code (self-review pass).
**Audience:** William + downstream agents driving Wave 35a (code) + Wave 35b (docs).

This doc is the input to Wave 35b. Findings are grouped into:

- **CRITICAL** — security or correctness regressions, fix in Wave 35a.
- **MODERATE** — doc rot, stale flags, missing handoffs; mostly Wave 35b territory.
- **MINOR** — TODOs and nits; not blocking.

When a finding ships in a wave, mark it `RESOLVED` and link the wave PR.

---

## Summary

| Severity | Count | Disposition |
|---|---|---|
| Critical | 0 | — |
| Moderate | 6 | Wave 35b owns 5; 1 (assertAssociationScope) filed as PPM workitem follow-up |
| Minor | (not enumerated here) | individual TODO sweeps as we go |

---

## Moderate findings

### M1 — `00-index.md` Layer 5 row statuses are stale

**Where:** `docs/projects/platform-overhaul/00-index.md` Layer 5 table.
**What's wrong:**

- 5.1 Empty states still says `IN BUILD (Wave 14, MVP slice)` — Wave 21 broadened adoption (commit `c07ade7`) and per-zone ErrorBoundary landed; should be promoted.
- 5.2 Error states same — Wave 21 broadened adoption.
- 5.3 Mobile audit still says `IN BUILD (Wave 14, MVP slice — full retrofit deferred)` — Waves 18 + 28 + 31 swept additional surfaces.
- 5.4 Performance audit doesn't reflect Wave 16b/19/22/33 (F1, F2, F4, F5, F6, F7, recharts replacement, background jobs) — should be `SHIPPED` or `IN BUILD · expanded`.
- 5.5 Accessibility audit / 5.6 i18n still show `Wave 21 top 10` — Waves 23 + 27 + 31 added 23 more surfaces.
- 5.7 Automated quality gates says `IN BUILD (Wave 25)` — Wave 25 landed and CI runs the gates; arguably `SHIPPED`.
- 5.8 motion-reduce — already `SHIPPED` (correct).
- 5.9 CI pipeline says `IN BUILD (Wave 30)` — Wave 30 PR #59 merged; should be `SHIPPED`.
- **5.10 Storybook (Wave 34) row missing entirely** — task is `in_progress`; no row exists. Add a placeholder if not yet landed.

**Resolution:** Wave 35b (docs catch-up).

### M2 — `00-index.md` missing Layer-4 4.1 Tier 3 row

**Where:** Layer 4 table.
**What's wrong:** Wave 32 shipped 4.1 Tier 3 alert push + email notifications (commit `d3d8299`, PR #63). Decision doc exists at `decisions/4.1-tier-3-notifications.md`. No row references it.

**Resolution:** Wave 35b — add row to Layer 4 table or split 4.1 into v1 / Tier 3 sub-rows.

### M3 — `00-index.md` Change Log gaps

**Where:** Change Log section at bottom of `00-index.md`.
**What's wrong:** Last entry is Wave 30 (2026-04-25). Missing entries for:

- Wave 22 (perf — recharts replaced with hand-rolled SVG, PR #54).
- Wave 23 (a11y round 2, PR #57).
- Wave 24 (i18n round 2, PR #58).
- Wave 25 (axe + visual regression, PR #56).
- Wave 26 (Playwright real-backend migration, PR #55).
- Wave 27 (a11y + i18n round 3, PR #61).
- Wave 28 (form-dialog mobile density, PR #60).
- Wave 29 already there (Wave 29 motion-reduce row exists).
- Wave 30 already there.
- Wave 31 (a11y + i18n round 4 + dialog mobile fixes, PR #64).
- Wave 32 (4.1 Tier 3 push + email, PR #63).
- Wave 33 (background rule runs + bundle trim, PR #65).

**Resolution:** Wave 35b — append Change Log entries (one per wave, 2-3 lines each).

### M4 — `api-reference-2026-04-25.md` missing Wave 32 + Wave 33 endpoints

**Where:** `docs/api-reference-2026-04-25.md`.
**What's wrong:** The reference is dated 2026-04-25 but Wave 32 + Wave 33 shipped that same evening and added at least 5 endpoints not in the doc:

- `GET /api/admin/notification-preferences` — Wave 32, operator-side severity prefs read.
- `PATCH /api/admin/notification-preferences` — Wave 32, operator-side severity prefs write.
- `GET /api/admin/push/vapid-public-key` — Wave 32, VAPID pubkey for service-worker subscribe.
- `POST /api/admin/push/subscribe` — Wave 32, persist push subscription.
- `DELETE /api/admin/push/subscribe` — Wave 32, remove push subscription.
- `GET /api/financial/jobs/:jobId` — Wave 33, background job status polling.

Total endpoint count "588" is now stale.

**Resolution:** Wave 35b — append rows under Platform + Financials zones + bump count.

### M5 — `architecture-2026-04-25.md` missing post-Wave-19 architecture decisions

**Where:** `docs/architecture-2026-04-25.md` § 3 (Architectural decisions).
**What's wrong:** The doc snapshot is "post-Wave-19 / pre-Wave-20." Multiple post-Wave-20 architectural artifacts deserve a subsection:

- **Wave 32 — Tier 3 alert notifications.** New `server/notifications.ts` orchestrator, `notificationPreferences` + `pushSubscriptions` tables, severity gate, rate limiter, Web Push + SMTP delivery. New flag(s).
- **Wave 33 — Background job queue.** New `background_jobs` table, `getBackgroundJobStatus()` helper, threshold-based escalation from sync to async on rule runs >500 units. Server bundle trimming as a side effect.
- **Wave 30 — CI pipeline.** New GitHub Actions workflow (`.github/workflows/ci.yml`) — already in 00-index Wave 30 entry but not in the architecture doc.
- **Wave 25 — Automated quality gates.** axe-core + visual regression in Playwright — also missing from the architecture doc.

The Feature Flag Inventory table also needs to grow if Wave 32 added a flag (e.g. `NOTIFICATIONS_ENABLED` or similar).

**Resolution:** Wave 35b — append four subsections + audit flag inventory.

### M6 — Pre-existing security finding: `assertAssociationScope` permissive on empty scopes

**Where:** `server/routes.ts:1053-1062`.
**What's wrong:**

```ts
function assertAssociationScope(req, associationId) {
  if (req.adminRole === "platform-admin") return;
  const scopedAssociationIds = req.adminScopedAssociationIds ?? [];
  if (!associationId) throw new Error("associationId is required");
  if (req.adminRole && scopedAssociationIds.length > 0 && !scopedAssociationIds.includes(associationId)) {
    throw new Error("Association is outside admin scope");
  }
}
```

When `scopedAssociationIds.length === 0` (e.g. a Manager without any explicit association scope rows), the check short-circuits to "allowed" — every association passes. This is a defense-in-depth gap; in practice `req.adminUser` association membership is enforced upstream by `requireAdmin` and the storage layer's `whereAssociationId` filters, but the helper itself is permissive.

**Resolution:** NOT in Wave 35a (out of scope for that wave). File a PPM workitem to harden the check (fail-closed when `scopedAssociationIds` is empty for non-platform-admin roles, after auditing all call sites for callers that intentionally rely on the empty-scope = global-allow behavior).

---

## Out of scope for Wave 35b

- Authoring per-wave handoff docs from scratch (Waves 22–34). If a doc is truly missing, add a 5-line stub pointing to the wave's PR; otherwise leave alone.
- Full TODO sweep across the codebase. Only delete TODOs whose completion is verifiable from `git log`.
- Promoting any module status without matching evidence in `git log`.

---

## Resolved

_(empty — populated as Wave 35a + 35b ship)_
