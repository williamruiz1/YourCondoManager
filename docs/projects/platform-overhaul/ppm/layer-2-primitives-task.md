# PPM Task Card — Layer-2 Primitives Bundle
**PPM Task ID:** `a84162c2-cb6d-4bb0-b889-29a953b75f20`
**Title:** Platform Overhaul Layer-2 Primitives Bundle — 3-phase flag-gated rollout (8a.0/8a/8b/8c)
**Status:** queued
**Priority:** critical
**Assignee:** Computer (Phases 8a/8b/8c); William owns Phase 8a.0 audit signoff gate
**Layer:** 2 (Role & Permission Model)
**Module:** Layer-2-primitives (covers 2.1, 2.2, 2.3)
**Upstream dependency:** Layer 1 complete, Phase 5b flag plumbing, Phase 8a.0 audit clean
**Decision docs:**
- [`../decisions/2.1-role-model-audit.md`](../decisions/2.1-role-model-audit.md)
- [`../decisions/2.2-owner-portal-access-boundaries.md`](../decisions/2.2-owner-portal-access-boundaries.md)
- [`../decisions/2.3-permission-boundary-corrections.md`](../decisions/2.3-permission-boundary-corrections.md)
- [`../decisions/3.3-role-gating-corrections.md`](../decisions/3.3-role-gating-corrections.md) (Q1 backbone)

**Handoff:** [`../handoffs/layer-2-primitives-handoff.md`](../handoffs/layer-2-primitives-handoff.md)
**Process skill:** [`../../../skills/spec-first-overhaul-process-skill.md`](../../../skills/spec-first-overhaul-process-skill.md)
**Plan reference:** `/home/runner/.claude/plans/floofy-hopping-dusk.md` — **Phases 8a.0, 8a, 8b, 8c (strict sequential)**
**Spec status:** SPEC LOCKED (2.1, 2.2, 2.3 all locked)
**Created:** 2026-04-20

---

## Objective

Ship the Layer 2 primitives bundle in strict sequential phases behind flag gates:

- **Phase 8a.0** — Production data audit signoff gate owned by William: enumerate every distinct `admin_users.role` value, classify canonical vs alias; enumerate every `portal_accesses.role` row; enumerate all 544 `server/routes.ts` handlers into `requireAdmin*` / `requirePortal*` / `requireVendorPortal` / `public-by-design` / `gating-bug` classifications. No code changes until William signs off this audit.
- **Phase 8a** — Portal role enum collapse (`tenant`, `readonly`, `board-member` → `owner`), SQL migration, `portalAccessRoleEnum` narrowed to `["owner"]`, `PortalRequest` retyping, `requirePortalBoard` + `requirePortalBoardReadOnly` retirement. Flag-gated via `PORTAL_ROLE_COLLAPSE`.
- **Phase 8b** — 2.2 in-place patches: `/portal/amenities` session gate fix (2.2 Q6), 1.4 Q7 portal title sprinkle in the mega-file, 2.3 Q6 Settings guard, 2.3 Q5 Portfolio role-based redirect, 2.3 Q11 admin-family `<RouteGuard>` wrappers.
- **Phase 8c** — Canonical primitives ship: `shared/AdminRole` export from `adminUserRoleEnum`, single `<RouteGuard>` component, `useIsReadOnly()` hook, collapsed `isSingleAssociationBoardExperience` shared helper. These primitives feed every 3.x zone landing.

This is the foundation Layer 3 builds on — no Layer 3 work may begin until 8c is green.

---

## Acceptance Criteria (tightly paraphrased from decision docs)

**From 2.1:**
1. 0.2 amended in a separate commit to add Persona 4 — Platform Admin (YCM staff/PM employee, controlled internal access, not a customer persona) (2.1 Q1)
2. `viewer` remains in `adminUserRoleEnum` as read-only capability variant of Manager; not added to 0.2 as a persona (2.1 Q2)
3. Portal sub-roles `tenant`, `readonly`, `board-member` collapsed to `owner`; post-migration `portalAccessRoleEnum` contains only `owner`; `requirePortalBoard` / `requirePortalBoardReadOnly` retired (2.1 Q3)
4. Single canonical `AdminRole` exported from `shared/` derived from `adminUserRoleEnum`; all four parallel re-declarations (`App.tsx:89`, `app-sidebar.tsx:51`, `wip-features.ts:1`, `routes.ts:754`) replaced with imports; `isSingleAssociationBoardExperience` has exactly one shared definition (2.1 Q4)
5. Production data audit + migration removes all alias rows; `normalizeAdminRole` deleted or constrained to identity; silent `unknown → viewer` downgrade eliminated (2.1 Q5)
6. `canAccess()` returns `false` when role is nullish; pre-auth render solved with session-loading guard (2.1 Q7)
7. `PortalRequest.portalRole` / `portalEffectiveRole` typed as union derived from `portalAccessRoleEnum`; post-Q3 collapse = literal `"owner"` (2.1 Q8)
8. Classification table covering all 544 handlers committed as implementation output; every `gating-bug` filed as remediation before 2.3 can close (2.1 Q9)
9. `hubVisibilityLevelEnum` renamed to a vocabulary with no overlap with role enums (2.1 Q11)

**From 2.2:**
10. Board-in-portal subsurface retained read-only (API-level `requirePortalBoardReadOnly` subsumed by Q3 collapse); no new board-surface endpoints added; Owner Portal sidebar stays Owner-only (2.2 Q1)
11. `/portal/amenities` inherits the `/portal` session-redirect pattern (2.2 Q6)

**From 2.3:**
12. Every sensitive `/app/*` route has both `<RouteGuard>` client wrapper and server middleware (2.3 Q2)
13. `AuthAwareApp:1051-1057` shunt retired; `BoardAdminPortalShell` / `BoardPortal` retired as Board Officer / Assisted Board entry point; code comment citing 2.3 added before removal (2.3 Q3)
14. All sidebar `roles` arrays normalized to 0.2 matrix; no entries contradict the matrix (2.3 Q4)
15. Any `board-officer` / `assisted-board` session at `/app/portfolio` is redirected to `/app` — role-based, not count-based (2.3 Q5)
16. `/app/settings` wrapped with `<RouteGuard roles={["manager", "platform-admin", "board-officer"]}>`; header settings icon renders conditionally (2.3 Q6)
17. Financial pages render read-only for `assisted-board` via `useIsReadOnly()` hook; all write affordances gate on `!isReadOnly` (2.3 Q7)
18. All `/app/admin*` routes wrapped with `<RouteGuard roles={["platform-admin"]}>`; tab group `board-admin` entries on roadmap + executive removed (2.3 Q11)
19. `<RouteGuard>` is the canonical enforcement component; all ad-hoc inline ternary gates replaced (2.3 Q9)
20. Ambient pages gated per Q12: `/app/insurance`, `/app/community-hub`, `/app/amenities` → Manager + Board Officer / Assisted Board; `/app/help-center` → all roles, no gate; `/app/association-context` → Manager only (2.3 Q12)

---

## Build Gate

Computer may not begin implementation until a handoff doc exists at:

```
docs/projects/platform-overhaul/handoffs/layer-2-primitives-handoff.md
```

The handoff doc enumerates the strict 8a.0 → 8a → 8b → 8c sequencing, the flag plumbing requirements, the Phase 8a.0 audit deliverables William must sign off before any code ships, the Phase 8a migration script with reverse migration, the Phase 8c primitive interfaces, and the validation steps. Until that file exists, this task remains `queued`.

**Critical:** William owns Phase 8a.0 audit signoff — no Computer-side code changes until William approves. Layer 3 cannot begin until 8c lands.

---

## Status Transitions

| Transition | When | Who |
|---|---|---|
| `queued → assigned` | Handoff doc published, Phase 5b flag plumbing complete | YCM Command Center |
| `assigned → in_progress` | Phase 8a.0 audit signed off by William; Computer calls `ppm_start_work` | William (signoff) / Computer |
| `in_progress → review` | Phases 8a/8b/8c all merged, parity maintained, primitives consumable by Layer 3, ACs met | Computer (via `ppm_workitem_transition`) |
| `review → approved` | PM approves on dashboard | PM (not agent-side) |
| `approved → done` | PM closes | PM (not agent-side) |

On Phase 8a merge, update Layer 2 status in `00-index.md` to reflect primitives-in-progress. On `review` after 8c, update to `IN REVIEW`. On PM approval, update to `COMPLETE` and unblock Layer 3.
