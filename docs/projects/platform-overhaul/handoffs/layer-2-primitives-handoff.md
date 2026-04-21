# Handoff — Layer 2 Primitives Bundle (2.1 + 2.2 + 2.3)

**PPM Task:** `{{TBD — file via ppm_workitem_create}}` (one card covers the bundle)
**Title:** Layer 2 Primitives Bundle — `<RouteGuard>` + portal enum collapse + `canAccess` null-fix + `AdminRole` canonical + `requirePortalBoard` retirement
**Governing specs:**
- [`../decisions/2.1-role-model-audit.md`](../decisions/2.1-role-model-audit.md) (SPEC LOCKED)
- [`../decisions/2.2-owner-portal-access-boundaries.md`](../decisions/2.2-owner-portal-access-boundaries.md) (SPEC LOCKED)
- [`../decisions/2.3-permission-boundary-corrections.md`](../decisions/2.3-permission-boundary-corrections.md) (SPEC LOCKED)
- [`../decisions/3.3-role-gating-corrections.md`](../decisions/3.3-role-gating-corrections.md) Q1 backbone (Phase 8a/8b/8c = Steps 1–4 of the landing sequence)
**Layer:** 2 · **Status:** SPEC LOCKED across 2.1, 2.2, 2.3
**Dependencies:** 0.2 (LOCKED, amended `f8dbf76`) · 0.3 (LOCKED) · 1.1 / 1.2 / 1.3 / 1.4 (LOCKED) · Phase 5b flag plumbing shipped · Phase 8a.0 audit clean and signed off
**Plan phases:** **8a, 8b, 8c** (three-phase flag-gated rollout)
**Downstream:** Phases 9–16 (parity harness authorship, hub pages, and the five RouteGuard zone landings) all consume the primitives this bundle supplies
**Amendment watch:** William

---

## Before You Start — Required Reading

Read in order. Do not begin edits until all of the following are read:

1. `AGENTS.md` (repo root)
2. `docs/projects/platform-overhaul/00-index.md`
3. `docs/projects/platform-overhaul/decisions/2.1-role-model-audit.md` — governs `AdminRole` canonicalization, `normalizeAdminRole` disposition, portal-enum narrowing source of truth, `canAccess` null-fix, `PortalRequest` retyping.
4. `docs/projects/platform-overhaul/decisions/2.2-owner-portal-access-boundaries.md` — governs `requirePortalBoard` / `requirePortalBoardReadOnly` retirement, portal sub-role collapse to `owner`, 29 board-in-portal endpoints' containment.
5. `docs/projects/platform-overhaul/decisions/2.3-permission-boundary-corrections.md` — governs the `<RouteGuard>` pattern, shell-shunt retirement coordination, and the 31-route server-only-gate catalogue.
6. `docs/projects/platform-overhaul/decisions/3.3-role-gating-corrections.md` Q1 landing-sequence backbone (Steps 1–4 map to Phase 8a/8b/8c).
7. `docs/projects/platform-overhaul/adrs/0b-routeguard-personaaccess-contract.md` — frozen contract for `<RouteGuard>` and `shared/persona-access.ts` (Phase 0b.2 skeleton lands separately; this bundle must not re-litigate that contract).

Then call `mcp__pocketpm__ppm_bootstrap`, open the PPM bundle task via `mcp__pocketpm__ppm_start_work`, and flip modules 2.1 / 2.2 / 2.3 in `00-index.md` from `SPEC LOCKED` to `IN BUILD` in the same commit that opens the Phase 8a PR.

No product decision beyond what the four decision docs lock may be inferred. If you hit ambiguity, stop and file `ppm_human_task_create`.

---

## Objective

Land the permission primitives that `<RouteGuard>` and every zone landing depend on. This is the riskiest foundation work in the overhaul: it combines a **DDL migration** (portal enum collapse on `portal_accesses.role`), **middleware retirements** (`requirePortalBoard`, `requirePortalBoardReadOnly`), **role-enum canonicalization** (single `AdminRole` export deduplicating four parallel declarations), a **client-side strict-false fix** (`canAccess` on nullish role, closing the 0.3 AC 21 gap), and a **feature-flag-gated rollout** (`PORTAL_ROLE_COLLAPSE`) that sequences schema migration → server retype → client retype without ever leaving the system in a state where either layer assumes a portal role vocabulary the other has not yet accepted. When this bundle ships, every downstream Layer 3 zone landing can rely on (a) a single canonical `AdminRole` type, (b) `PortalRequest.portalRole` narrowed to the literal `"owner"`, (c) `canAccess` that strictly denies unauthenticated callers, and (d) no `requirePortalBoard*` middleware anywhere in `server/routes.ts`.

---

## Phase 8a.0 — Pre-migration prod data audit (read-only gate)

**Purpose:** Phase 8a.0 is the only true rollback lever for the DDL migration. The audit must be clean before Phase 8a opens a PR. A DDL collapse cannot be rolled back via feature flag once rows are rewritten; the audit IS the rollback — if it finds recently-active alias rows, we do not deploy and we remediate first.

**Ownership split:** William runs the query (he holds prod read access). Agent drafts the query, interprets the result, and writes the baseline doc.

**Audit query (read-only, run in prod):**
```sql
SELECT role, COUNT(*) AS row_count, MIN(created_at) AS first_seen, MAX(created_at) AS last_seen
FROM portal_accesses
GROUP BY role
ORDER BY role;
```

**Sampling requirement:** For every non-`owner` role returned (`tenant`, `readonly`, `board-member`), sample 20 rows:

```sql
SELECT id, role, status, association_id, email, last_login_at, created_at
FROM portal_accesses
WHERE role = '<role-value>'
ORDER BY last_login_at DESC NULLS LAST
LIMIT 20;
```

**Decision rubric:**
- If any `tenant`, `readonly`, or `board-member` row has `last_login_at` within the last 30 days → **halt Phase 8a**, file a remediation workitem via `ppm_workitem_create`, and escalate to William.
- If all non-`owner` rows are dormant (>30 days since login) or have never logged in → **proceed to Phase 8a**.
- If the `board-member` subtotal is non-zero but all rows are dormant, document the migration's expected downgrade in the baseline doc and note in the Phase 8a PR description that legacy board-in-portal access is being retired per 2.2 Q1 containment.

**Output:** Write the audit result, interpretation, and decision (proceed / halt) to `docs/projects/platform-overhaul/baselines/portal-enum-audit-2026-04.md`. The doc must include: query run, raw counts per role, first/last seen timestamps per role, sample rows (email redacted), decision rationale, and William sign-off line.

**Gate to Phase 8a:** Baseline doc committed, William's sign-off line filled in, remediation workitem either (a) closed with resolution, or (b) confirmed not required.

---

## Phase 8a — Portal enum collapse (3.3 Q1 Step 1)

**Scope:** Collapse `portalAccessRoleEnum` to a single value (`owner`) via SQL migration, behind the `PORTAL_ROLE_COLLAPSE` feature flag. This is the schema-layer half of 2.1 Q3 / 2.2 Q2; the server and client halves ride in Phase 8b and Phase 8c.

**Files touched:**
- `shared/schema.ts` — narrow `portalAccessRoleEnum` definition at `:1084` from `["owner", "tenant", "readonly", "board-member"]` to `["owner"]`.
- New Drizzle migration under `migrations/` (or equivalent) — idempotent, transactional SQL that rewrites every `portal_accesses.role` row whose value is `tenant`, `readonly`, or `board-member` to `owner`, then alters the pgEnum.
- `shared/feature-flags.ts` — introduce `PORTAL_ROLE_COLLAPSE` flag (default `false`).

**Migration contract:**
1. **Transactional.** Whole migration runs in a single `BEGIN`/`COMMIT` block. If any row update or `ALTER TYPE` fails, the transaction rolls back and no data is changed.
2. **Idempotent.** Re-running the migration on an already-collapsed database is a no-op (rows already `owner`; enum already narrowed). The migration must guard with an existence check on enum values before altering.
3. **Pre/post row-count validation.** Before the update, capture `SELECT COUNT(*) FROM portal_accesses GROUP BY role` into a migration log line. After the update, capture the same count. Post-count for non-`owner` roles must be zero; post-count for `owner` must equal the pre-sum across all four values.
4. **Reverse migration script.** Write a companion `down.sql` (or the Drizzle equivalent) that restores the four-value enum. The reverse script cannot restore the original per-row `role` values — that is why Phase 8a.0 is the audit gate. The reverse script only restores the schema shape so that a later remediation PR can backfill role values from a separately-maintained log if needed.
5. **Staging dry-run mandatory.** Run the migration against a staging database refreshed from a recent prod snapshot. Verify pre/post counts match the prod audit (Phase 8a.0) one-for-one. Do not proceed to prod until staging is clean.

**Feature-flag behavior:**
- `PORTAL_ROLE_COLLAPSE=false` (default) — the server retains the four-value enum assumption in its type narrowing paths (which is still Phase 8b's deliverable; Phase 8a ships flag-gated so the enum narrowing lands in code but is not yet enforced by Phase 8b's server retype).
- `PORTAL_ROLE_COLLAPSE=true` — the server narrows `PortalRequest.portalRole` to `"owner"` (Phase 8b's code path); the `requirePortalBoard*` retirement is effective.
- Flag flipped to `true` in staging after Phase 8a migration completes clean; flipped to `true` in prod after staging runs clean for one release cycle.

**Proof required:**
- Staging migration log with pre/post counts attached to Phase 8a PR.
- Prod migration log with pre/post counts attached as a post-merge comment on the Phase 8a PR.
- Zero `portal_accesses.role` rows with value `tenant`, `readonly`, or `board-member` post-migration (AC-Q2-4).
- `portalAccessRoleEnum` at `shared/schema.ts:1084` contains only `["owner"]` (AC-Q2-1).

---

## Phase 8b — Server retype + `requirePortalBoard` retirement (3.3 Q1 Steps 2–3)

**Scope:** Land the server-side half of the portal narrowing and the null-role fix simultaneously. `PortalRequest` retyped to the narrowed enum literal; `requirePortalBoard` and `requirePortalBoardReadOnly` deleted; 29 board-in-portal endpoints consolidated per 2.2 Q1; `canAccess` / `canAccessTab` null-role strict-false fix applied; session-loading guard suppresses sidebar render while role is undefined. The `PORTAL_ROLE_COLLAPSE` flag remains live in Phase 8b — it gates the server-side assumption that portal role is always `owner`.

**Files touched:**
- `server/routes.ts` — many. `PortalRequest.portalRole` at `:767` and `PortalRequest.portalEffectiveRole` at `:770` retyped from `string` to the literal `"owner"` (derived from the narrowed `portalAccessRoleEnum`). `requirePortalBoard` at `:1097-1102` and `requirePortalBoardReadOnly` at `:1104-1106` deleted. All 29 `/api/portal/board/*` handlers plus the handful of non-`board` handlers that reference `requirePortalBoard*` switched to `requirePortal` (which already validates an active portal-access-id). `resolvePortalAccessContext` at `:1083-1095` narrowed to no longer branch on removed role values.
- `server/middleware/*.ts` — any middleware files that import or re-export `requirePortalBoard` / `requirePortalBoardReadOnly` cleaned up.
- `shared/types.ts` (if PortalRequest lives there) — align the `PortalRequest` type definition with the narrowed enum. If `PortalRequest` is declared inline in `server/routes.ts:754+` only, the edit is localized.
- `client/src/components/app-sidebar.tsx:209-213` — `canAccess()` returns `false` when `role` is `undefined` or `null` (AC-Q3-1).
- `client/src/App.tsx:649` — `canAccessTab` identically fixed to return `false` on nullish role.
- `client/src/App.tsx` — session-loading guard wrapping `AppSidebar` so that no nav items render while `authSession` is `undefined`. The guard renders a loading shimmer (or empty shell) in place of the sidebar until auth resolves (AC-Q3-2). This is NOT a redirect-to-login; unauthenticated users on `/app/*` already reach `WorkspacePreviewPage` via the shell dispatch at `App.tsx:1041-1057`.

**Endpoint consolidation detail (2.2 Q1):** All 29 `/api/portal/board/*` endpoints are retired or rewritten per 2.2 Q1's board-in-portal containment. The board workspace surface is not supported in `/portal`; board personas reach governance surfaces through `/app` with per-route `<RouteGuard>` gates in Layer 3. Any handler whose only gate was `requirePortalBoard` / `requirePortalBoardReadOnly` is deleted outright. Any handler whose logic legitimately serves owners (e.g., reads of owner-scoped data that accidentally lived under `/api/portal/board/*`) is rewritten to serve `requirePortal`-gated owner reads only — the board-branch in the response shape is removed.

**Flag scope in Phase 8b:** `PORTAL_ROLE_COLLAPSE` still live. The flag now gates the runtime assertion that `req.portalRole === "owner"` in any residual portal-branch logic. When the flag is `false` in prod, the server still accepts four-value reads but does not emit four-value types (type checking proceeds as if collapsed); when `true`, the server asserts `"owner"` at runtime and rejects any residual non-`owner` row (which should not exist after Phase 8a's migration). The flag is not a feature toggle for end users — it is a rollback lever for the narrowing rollout.

**Null-role fix unit tests (required before merge):**
- `canAccess(null, roles)` returns `false` for every `roles` combination (AC-Q3-3).
- `canAccess(undefined, roles)` returns `false` for every `roles` combination (AC-Q3-3).
- `canAccessTab` identically covered.
- Sidebar integration test: when `authSession` is `undefined`, the sidebar DOM contains zero nav items (AC-Q3-2). When `authSession.admin.role` is a canonical role value, the sidebar renders only the nav items permitted for that role per the 0.2 matrix.

**Proof required:**
- Grep `requirePortalBoard`, `requirePortalBoardReadOnly` across `server/` returns zero hits (AC-Q2-3).
- `PortalRequest.portalRole` and `PortalRequest.portalEffectiveRole` typed as `"owner"` — not `string` — in the narrowed source (AC-Q2-2).
- `npm run check` clean (TypeScript baseline error count does not increase).
- Vitest unit tests pass: `canAccess(null)`, `canAccess(undefined)`, sidebar loading-state suppression (AC-Q3-3).
- The 29 `/api/portal/board/*` endpoints either deleted or re-gated to `requirePortal` with owner-only response shape; containment inventory attached to Phase 8b PR description.

---

## Phase 8c — Client retype + `AdminRole` canonical + flag removal (3.3 Q1 Step 4)

**Scope:** `AdminRole` deduplicated into a single canonical export; four parallel declarations replaced with imports; `isSingleAssociationBoardExperience` collapsed into one shared helper; `PORTAL_ROLE_COLLAPSE` flag removed from code (hardcoded "always-on" path); grep sweeps verify zero alias rows and zero `normalizeAdminRole` imports remain (the normalizer itself is removed in Phase 14 per 3.3 Q7, but its client consumers must already have migrated away by Phase 8c to avoid orphan imports).

**Files touched:**
- `shared/schema.ts` — export `AdminRole` derived from `adminUserRoleEnum` (via drizzle-zod `inferSelect` or equivalent). This becomes the single canonical `AdminRole` type.
- `shared/` helpers module (new file `shared/persona-helpers.ts` or similar) — export `isSingleAssociationBoardExperience` from one location.
- `client/src/App.tsx:89` — delete local `AdminRole` declaration; replace with `import { AdminRole } from "@shared/schema"` (or the repo's canonical shared path).
- `client/src/App.tsx:192-194` — delete local `isSingleAssociationBoardExperience`; replace with import.
- `client/src/components/app-sidebar.tsx:51` — delete local `AdminRole` declaration; replace with import.
- `client/src/components/app-sidebar.tsx:216` — delete duplicate `isSingleAssociationBoardExperience`; replace with import.
- `client/src/lib/wip-features.ts:1` — delete local `AdminRole` declaration; replace with import.
- `server/routes.ts:754` — delete local `AdminRole` declaration; replace with import.
- `shared/feature-flags.ts` — delete the `PORTAL_ROLE_COLLAPSE` flag entry entirely. Delete every `if (isFlagOn("PORTAL_ROLE_COLLAPSE"))` branch across `server/` and `client/`. The "always-on" path becomes the hardcoded default.

**Post-Phase-8c grep sweep (required proof):**
- `grep -rE "^(type|interface)\s+AdminRole" client/ server/ shared/` returns exactly one hit (the canonical `shared/schema.ts` export) (AC-Q2-6).
- `grep -rE "^\s*(export )?function isSingleAssociationBoardExperience" client/ server/ shared/` returns exactly one hit (AC-Q2-5).
- `grep -r "PORTAL_ROLE_COLLAPSE" .` returns zero hits.
- `grep -r "normalizeAdminRole" client/` returns zero hits (client-side consumers have migrated off; the server-side function itself is deleted in Phase 14 per 3.3 Q7 — Phase 8c only enforces the client-side absence).
- `grep -rE "'(tenant|readonly|board-member)'" client/src/ server/` returns zero hits in role-context usages (hub-visibility enum is a separate vocabulary per 2.1 Q11 and is out of scope for this grep; restrict the sweep to files importing `portalAccessRoleEnum` or `PortalRequest`).

**Proof required:**
- All grep sweeps clean.
- `npm run check` green (AC-Q9-2 analogue for Layer 2).
- Zero test regressions in Vitest.
- Phase 8c PR description includes before/after grep outputs.

---

## Ordering + gates (strict)

**Canonical order:** 8a.0 → 8a → 8b → 8c. Each gate requires the prior to pass staging plus William sign-off. **Do NOT bundle or reorder.** Do NOT combine Phase 8a migration with Phase 8b server retype in a single PR — the flag gate exists precisely to decouple DDL rollout from code rollout.

**Gate matrix:**

| Gate | Entry criterion | Exit proof |
|---|---|---|
| 8a.0 → 8a | Audit doc committed with William sign-off; no active alias rows within 30-day login window | `docs/projects/platform-overhaul/baselines/portal-enum-audit-2026-04.md` linked in Phase 8a PR |
| 8a → 8b | Migration passed staging dry-run with matching pre/post counts; prod migration executed with zero alias rows post-run; `PORTAL_ROLE_COLLAPSE` flipped to `true` in staging and prod with no regressions for one release cycle | Migration logs (staging + prod) attached to Phase 8a PR as post-merge comments |
| 8b → 8c | `requirePortalBoard*` grep clean; `PortalRequest` retyped; Vitest `canAccess(null/undefined)` and sidebar loading-state tests green; 29-endpoint containment inventory attached; William sign-off | Post-merge comment on Phase 8b PR with grep + test results |
| 8c → downstream | All grep sweeps clean; `PORTAL_ROLE_COLLAPSE` absent from code; `AdminRole` single-declaration proven; `npm run check` green | Phase 8c PR description + post-merge comment with full grep output |

**No zone landing (Phase 12–16) may begin until Phase 8c is fully merged and proven.** Phase 9 (full `shared/persona-access.ts` manifest) and Phase 10 (parity harness authorship) may proceed in parallel with Phase 8c only if they do not import any of the four legacy `AdminRole` declarations — if they do, they must rebase on the Phase 8c merge.

---

## Rollback policy

DDL rollback semantics differ from code rollback semantics. Read carefully before authorizing any revert.

**Phase 8a.0 (audit):** Read-only. No rollback needed. If the audit fails its decision rubric, Phase 8a never opens.

**Phase 8a (DDL migration):** **Cannot be rolled back via feature flag.** Once `ALTER TYPE` executes and row values are rewritten, the original `tenant` / `readonly` / `board-member` distinctions are lost. The reverse migration script restores the enum shape but does not restore per-row values. The only true rollback is the Phase 8a.0 audit — if the audit finds active non-`owner` rows and we deploy anyway, we have accepted the data loss for those rows. Post-deploy emergency fix: if a bug is discovered in the migration logic, the forward path is to re-add any needed enum value via a new migration, then remediate the affected rows manually using the audit baseline. No data is destroyed by the forward migration; only the distinction is collapsed.

**Phase 8b (server retype + `requirePortalBoard` retirement):** **Code-only. Reversible via PR revert.** If the retype or null-role fix causes regression, `git revert` the Phase 8b merge commit. The `PORTAL_ROLE_COLLAPSE` flag provides a second lever — flip to `false` to re-admit the four-value assumption at runtime without reverting code. Revert Phase 8b does not affect the Phase 8a migration — row data remains collapsed.

**Phase 8c (client retype + `AdminRole` canonical + flag removal):** **Code-only. Reversible via PR revert.** `git revert` the Phase 8c merge commit to restore the four `AdminRole` declarations, the duplicate `isSingleAssociationBoardExperience`, and the `PORTAL_ROLE_COLLAPSE` flag. The revert does not affect Phases 8a or 8b — the server remains retyped and the migration remains in place. If Phase 8c is reverted, downstream zone landings (Phases 12–16) pause until a re-land of Phase 8c ships.

**Stop-the-line triggers (per 3.3 Q10):**
- Any 401/403 on a route that should be permitted for any persona after Phase 8b deploy.
- Any unguarded access discovered on a route that should be blocked after Phase 8b deploy.
- Two or more JS console errors not present in the baseline (`docs/projects/platform-overhaul/baselines/pre-phase-8a-baseline.md` — capture before Phase 8a merges).
- Any Vitest Tier 1 parity test that was passing pre-deploy starts failing in CI.
- Any migration pre/post count mismatch.

Any of the above triggers an immediate revert per the corresponding phase's rollback procedure above, plus a PPM post-mortem workitem.

---

## Amendment watch

**Owner:** William.

**Escalation path:** If any of 2.1, 2.2, 2.3, or 3.3 Q1 amends mid-build, the executor stops, re-reads the amended Change Log, and files `ppm_human_task_create` for William before resuming. Do not re-interpret amended resolutions unilaterally.

**Re-read gate:** Before opening each of Phase 8a, 8b, and 8c PRs, re-read `docs/projects/platform-overhaul/00-index.md` Change Log and the four governing decision docs' Decision Logs. If any has amended since the prior phase merged, pause and re-align.

---

## Required proof (executor checklist)

Before transitioning the PPM bundle task to `review`, verify all of the following. Most are per-phase; a few are end-of-bundle.

- [ ] **Phase 8a.0 baseline doc** — `docs/projects/platform-overhaul/baselines/portal-enum-audit-2026-04.md` committed with query results, sample rows, decision rubric outcome, and William sign-off line filled.
- [ ] **Phase 8a staging migration log** — pre/post counts attached to Phase 8a PR as a file or PR-description block.
- [ ] **Phase 8a prod migration log** — pre/post counts attached as a post-merge comment on Phase 8a PR. Zero `tenant` / `readonly` / `board-member` rows post-migration.
- [ ] **`PORTAL_ROLE_COLLAPSE` flipped to `true` in staging** — logged with timestamp in Phase 8a PR.
- [ ] **`PORTAL_ROLE_COLLAPSE` flipped to `true` in prod** — logged with timestamp in Phase 8a PR after one release cycle of staging observation.
- [ ] **Vitest unit tests green** — `canAccess(null) === false`, `canAccess(undefined) === false`, `canAccessTab` identically covered, sidebar loading-state suppression (AC-Q3-3). Attached to Phase 8b PR.
- [ ] **29-endpoint containment inventory** — Phase 8b PR description lists every `/api/portal/board/*` handler with its disposition (deleted / re-gated to `requirePortal` with owner-only shape).
- [ ] **Zero `requirePortalBoard` / `requirePortalBoardReadOnly` references post-Phase-8b** — grep across `server/` returns zero hits (AC-Q2-3).
- [ ] **`PortalRequest.portalRole` and `PortalRequest.portalEffectiveRole` retyped** — not bare `string` (AC-Q2-2). Verified in Phase 8b PR diff.
- [ ] **Zero alias rows in prod post-Phase-8a** — confirmed via post-migration query attached to Phase 8a PR post-merge comment (AC-Q2-4).
- [ ] **`AdminRole` single-declaration** — grep `^(type|interface) AdminRole` across `client/`, `server/`, `shared/` returns exactly one hit post-Phase-8c (AC-Q2-6).
- [ ] **`isSingleAssociationBoardExperience` single-declaration** — grep returns exactly one hit post-Phase-8c (AC-Q2-5).
- [ ] **`PORTAL_ROLE_COLLAPSE` removed** — grep `PORTAL_ROLE_COLLAPSE` returns zero hits post-Phase-8c; flag key absent from `shared/feature-flags.ts`.
- [ ] **Zero `normalizeAdminRole` imports in `client/`** — grep returns zero hits post-Phase-8c (server-side deletion is Phase 14's scope per 3.3 Q7).
- [ ] **`npm run check` green** — TypeScript baseline error count from pre-Phase-8a is not exceeded post-Phase-8c (AC-Q9-2 analogue).
- [ ] **Module status** — 2.1, 2.2, 2.3 flipped in `00-index.md` from `SPEC LOCKED` → `IN BUILD` at Phase 8a kickoff; from `IN BUILD` → `IN REVIEW` after Phase 8c ships clean.
- [ ] **PR URLs** — Phase 8a, 8b, 8c PR URLs all recorded in the PPM bundle task.
- [ ] **Founder sign-off** — William approves Phase 8a before Phase 8b opens; approves Phase 8b before Phase 8c opens; approves Phase 8c before downstream Phase 9/10 consumers begin.

---

## Scope boundary — what this bundle does NOT cover

These are explicit out-of-scope items. Do not attempt inside Phase 8a / 8b / 8c; file separately if surfaced.

- **`normalizeAdminRole` server-side deletion** — scheduled for **Phase 14** (Governance zone landing) per 3.3 Q7. Phase 8c verifies the client side has no remaining imports, but does not delete the server-side function.
- **`<RouteGuard>` component authorship** — **Phase 0b.2** (stub) and post-ADR sign-off (real implementation). Phase 8b applies the null-role fix that `<RouteGuard>` depends on but does not build the component.
- **`shared/persona-access.ts` manifest** — **Phase 9**. Phase 8c ships the canonical `AdminRole` type that the manifest imports, but does not author the manifest.
- **Zone RouteGuard rollout (Financials → Operations → Governance → Communications → Platform)** — **Phases 12–16** per 3.3 Q5. This bundle supplies the primitives; the rollout consumes them.
- **BoardPortal shunt retirement** — **Phase 13** (Operations zone) per 3.3 Q6. Phase 8b's null-role fix is a pre-condition for the shunt retirement, but the shunt itself is not touched in this bundle.
- **`hubVisibilityLevelEnum` rename** — 2.1 Q11 follow-up. Out of scope for this bundle.
- **Vendor portal** — 2.1 Q10 declares out of scope for the entire overhaul. Do not touch `requireVendorPortal` or `VendorPortalRequest`.
- **Q5 `admin_users.role` audit and migration** — 2.1 Q5 implementation output; rides with Phase 14 per 3.3 Q7. Phase 8c does not touch `admin_users.role` rows.

---

## Session-end protocol

After each of Phase 8a, 8b, 8c PRs merges:

1. Transition the phase's sub-task in PPM via `ppm_workitem_transition` from `in_progress` → `review`.
2. Update `00-index.md` module status with the phase landing annotation in the same commit that merges the PR.
3. Call `mcp__pocketpm__ppm_sync`.
4. Call `mcp__pocketpm__ppm_checkpoint_end` (auto-runs blocker scan).
5. Before stopping, call `mcp__pocketpm__ppm_session_end`.

PM approves each phase PR and the final bundle closure on the pocketp.m. dashboard — do not attempt `approved` or `done` transitions yourself.
