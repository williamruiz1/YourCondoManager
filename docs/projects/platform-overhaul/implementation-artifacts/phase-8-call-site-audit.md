# Phase 8 Call-Site Impact Audit — Layer-2 Primitives Bundle

**Scope:** YCM Platform Overhaul — Phase 8a (`portalAccessRoleEnum` collapse), 8b (server retype + `requirePortalBoard` retirement), 8c (client retype + `AdminRole` dedup + flag removal).
**Status:** Read-only audit. No code modified.
**Upstream gate:** Phase 8a is blocked on Phase 8a.0 prod-data audit (William-run). The 8b/8c call-site map is producible now.
**Backbone cross-ref:** 3.3 Q1 role-gating decision + 2.2 Q1 (29 board endpoints) + 5b feature-flag helper (`shared/feature-flags.ts`).

---

## Phase 8a impact — `portalAccessRoleEnum` collapse

### Enum current values
`/home/runner/workspace/shared/schema.ts:1087`
```
portalAccessRoleEnum = pgEnum("portal_access_role", ["owner", "tenant", "readonly", "board-member"])
```
Single table consumer: `/home/runner/workspace/shared/schema.ts:1095` (`portalAccess.role` column, default `"owner"`).

Plan target: collapse to `["owner", "board-member"]` (drop `tenant`, `readonly`). Effective-role view layers (`owner-board-member` etc.) remain in application code (`server/storage.ts:4136`, `12648`).

### Call sites per alias value

**`"tenant"` — 35 hits total (client + server)**

Server (`server/routes.ts` — 3 hits):
- `8738`, `8765` — `residentType !== "tenant"` guard (ownership/occupancy submission; distinct from portal role).
- `15268` — hub visibility bucketing: `["tenant","owner","board-member","readonly"].includes(role)`.

Server (`server/storage.ts` — 32 hits): rows `329`, `3630`, `3637`, `4030`, `4051`, `4136`, `4698`, `5205`, `5396`, `5405`, `5429`, `5568`, `5623`, `5887`, `6044`, `6067`, `6076`, `6174`, `6183`, `11504`, `11617`, `11696`, `11707`, `11838`, `11965`, `11972`, `11975`, `11993`, `12001`, `12010`, `12026`, `12069`, `12648`, `12697` (as type), `13805`.

Client (10 hits): `pages/announcements.tsx:233`, `pages/onboarding-invite.tsx:23`, `pages/association-context.tsx:116,485,1245,1249`, `pages/persons.tsx:46,60,118,228,370,383,469`, `pages/communications.tsx:252,315,635,1186,1190`, `pages/platform-controls.tsx:963`.

**`"board-member"` — 26 hits**

Server (`server/routes.ts` — 9 hits): `788`, `10463`, `10530`, `10679`, `11807`, `11808`, `15268`, `15269`, `15270`.
Server (`server/storage.ts` — 15 hits): including type positions `329`, `4030`, `4051`, `4136`, `11504`, `11617`, `11838`, `11965`, `12648` and branches `12014`, `12026`, `12069`, `12697`, `12707`, `12763`.
Client (2 hits): `pages/board-packages.tsx:110`, `pages/board-portal.tsx:467`, `pages/platform-controls.tsx:963`, `components/setup-wizard.tsx:503`.

**`"readonly"` — 4 hits**

Server (`server/routes.ts` — 2 hits): `15256` (`req.portalRole || "readonly"` default), `15268` (visibility bucket).
Server (`server/storage.ts` — 2 hits): `4136`, `12648` (effective-role union).
Client: 1 hit `pages/platform-controls.tsx:963`.

### Files touched (Phase 8a)
1. `shared/schema.ts` (enum definition + column default).
2. `server/storage.ts` (union types + residentType/role branches; **high density**).
3. `server/routes.ts` (hub visibility, board-member guards).
4. `client/src/pages/platform-controls.tsx` (admin-facing role selector).
5. `client/src/pages/board-packages.tsx`, `board-portal.tsx` — literal constants.
6. `tests/utils/auth-helpers.ts:83–94` (defaults `portalRole = "owner"`).

### Risk per site
- **Trivial:** `platform-controls.tsx:963` SelectItem list (cosmetic enum list).
- **Trivial:** `pages/board-packages.tsx:110`, `board-portal.tsx:467` (string equality filter/constant).
- **Needs care:** `server/storage.ts` resident-vs-owner branching (lines `5887`, `6044`, `6067`, `6076`, `6174`, `6183`) — writes `role: "tenant"` on portal provisioning. Must map to whichever surviving value 8a selects. Per 3.3 Q1, tenant collapses to `readonly`-equivalent → collapsed enum still only has `owner|board-member`, so provisioning path must switch to `owner` + occupancy flag, or a non-portal-role tenant table.
- **Needs care:** `server/storage.ts:12706–12708` `effectiveRole` derivation — the view returns `"tenant"` / `"readonly"` today; downstream consumers (`routes.ts:10781`, `11808`) propagate it. Must preserve the view contract even if the stored enum collapses.
- **Blocker:** `routes.ts:15256–15270` hub visibility — the `"readonly"` default protects against null `portalRole`; collapsing without rewiring `req.portalRole` fallback would flip an anonymous visitor from resident → nothing.

**Phase 8a total call-site count: ~65** (2 schema + ~47 `storage.ts` + ~12 `routes.ts` + ~6 client + 1 tests-helper).

---

## Phase 8b impact — server retype + `requirePortalBoard` retirement

### `requirePortalBoard` / `requirePortalBoardReadOnly` call sites

Definition: `server/routes.ts:1099` (`requirePortalBoard`) and `server/routes.ts:1106` (`requirePortalBoardReadOnly`).

`requirePortalBoard` call sites — 29 endpoints (matches 2.2 Q1 expectation exactly):

1. `11571` GET `/api/portal/board/overview`
2. `11580` GET `/api/portal/board/dashboard`
3. `11859` GET `/api/portal/board/association`
4. `11970` PATCH `/api/portal/board/association`
5. `11994` GET `/api/portal/board/meetings`
6. `12003` POST `/api/portal/board/meetings`
7. `12024` PATCH `/api/portal/board/meetings/:id`
8. `12047` GET `/api/portal/board/governance-tasks`
9. `12056` POST `/api/portal/board/governance-tasks`
10. `12074` PATCH `/api/portal/board/governance-tasks/:id`
11. `12094` GET `/api/portal/board/documents`
12. `12103` POST `/api/portal/board/documents`
13. `12127` PATCH `/api/portal/board/documents/:id`
14. `12145` GET `/api/portal/board/communications/sends`
15. `12155` GET `/api/portal/board/communications/history`
16. `12164` POST `/api/portal/board/communications/send`
17. `12187` PATCH `/api/portal/board/maintenance-requests/:id`
18. `12209` GET `/api/portal/board/vendor-invoices`
19. `12218` POST `/api/portal/board/vendor-invoices`
20. `12240` PATCH `/api/portal/board/vendor-invoices/:id`
21. `12264` GET `/api/portal/board/owner-ledger/entries`
22. `12273` GET `/api/portal/board/owner-ledger/summary`
23. `12282` POST `/api/portal/board/owner-ledger/entries`
24. `12306` GET `/api/portal/board/persons`
25. `12315` PATCH `/api/portal/board/persons/:id`
26. `12329` GET `/api/portal/board/units`
27. `12338` PATCH `/api/portal/board/units/:id`
28. `12356` GET `/api/portal/board/roles`
29. `12365` POST `/api/portal/board/roles`

`requirePortalBoardReadOnly` appears on 16 of these (mutations only). Smoke-test reference in `/home/runner/workspace/script/verify-owner-portal-multi-unit.ts:137` asserts the guard remains; it will need an update once the guard is retired.

### `PortalRequest` type

Definitions (4):
- `server/routes.ts:762`
- `server/routes/amenities.ts:20`
- `server/routes/autopay.ts:51` (exported)
- `server/routes/payment-portal.ts:42`

Usages: **102 references** across the 4 files. The `autopay.ts:51` export is already the canonical shape; Phase 8b should centralize on it (or move to `shared/`) and delete the 3 duplicates. Fields on PortalRequest: `portalAccessId`, `portalPersonId`, `portalAssociationId`, `portalEmail`, `portalRole`, `portalEffectiveRole`, `portalHasBoardAccess`, `portalUnitIds` (set in `routes.ts:1078–1095`).

### `canAccessTab` (client)

Sole definition: `client/src/App.tsx:661`. Call site: `App.tsx:679` (single). Function is local to `App.tsx` — zero external importers.

Although listed under Phase 8b in the prompt, this is a client symbol; retyping signature (`AdminRole` → central type) is a 8c concern once `AdminRole` is hoisted. No extra work for 8b.

### `canAccess` + null-role handling sites

Two `canAccess` local functions (client):
- `client/src/components/app-sidebar.tsx:232` → called at `244`, `247`.
- `client/src/components/global-command-palette.tsx:52` → called at `130`, `135`, `136`, `177`.

Null-role reachable sites (client, `role?: AdminRole | null`):
- `App.tsx:661` `canAccessTab` (null guard line `663`).
- `app-sidebar.tsx:232`, `238`, `242`, `251`.
- `global-command-palette.tsx:52`, `59`, `75`.
- `lib/wip-features.ts:7` `canAccessWipRoute`.
- `App.tsx:293` inline `canAccessWipRoute(..., adminRole)` — `adminRole` can be null.
- `pages/dashboard.tsx:526` (`authSession?.admin?.role ?? null`).

**Phase 8b total call-site count: ~140** (61 `requirePortalBoard`/`ReadOnly` mentions incl. definition + 102 `PortalRequest` references + 8 client null-role callers + the 29 endpoints listed).

---

## Phase 8c impact — client retype + `AdminRole` dedup + flag removal

### `AdminRole` duplicate definition sites

Plan called out 4; audit found **8 duplicate local definitions** (4 client + 4 server):

Client (all identical literal union):
1. `client/src/App.tsx:89`
2. `client/src/components/app-sidebar.tsx:51`
3. `client/src/components/global-command-palette.tsx:19`
4. `client/src/lib/wip-features.ts:1` (currently the only `export`ed copy — becomes canonical).
5. `client/src/pages/dashboard.tsx:214`
6. `client/src/pages/election-detail.tsx:32`
7. `client/src/pages/elections.tsx:28`
8. `client/src/pages/governance-compliance.tsx:37`

Server:
9. `server/routes.ts:755`
10. `server/routes/amenities.ts:13`
11. `server/routes/autopay.ts:42`
12. `server/routes/payment-portal.ts:33`

The prompt's "4 known" list missed `dashboard.tsx`, `election-detail.tsx`, `elections.tsx`, `governance-compliance.tsx`, `global-command-palette.tsx` and all 3 non-`routes.ts` server modules. **These are sites the plan did not anticipate.**

### Downstream `AdminRole` importer sites

Client AdminRole references: **40 occurrences** across 8 files. Server AdminRole references: **474 occurrences** (heavily inlined `requireAdminRole([...])` literal arrays, not symbol uses — the *type* itself is referenced ~30 places, same list as above).

Recommended consolidation: move canonical `AdminRole` to `shared/role-labels.ts` (already exists — `/home/runner/workspace/shared/role-labels.ts`) or a sibling `shared/roles.ts`. Every file above changes its local `type AdminRole = …` to `import type { AdminRole } from "@shared/roles"`. Mechanical.

### `normalizeAdminRole`

Single definition: `server/routes.ts:779`. Sole call site: `server/routes.ts:798` (inside `applyAdminContext`). Phase 14 will delete this once the DB has no un-normalized roles; Phase 8c only notes its position and does not touch it.

### `PORTAL_ROLE_COLLAPSE` flag removal impact

Flag definition: `shared/feature-flags.ts:35` + default `false` at `:45`.

Current consumers (as of this audit): **zero production code paths** — the only references are in `tests/feature-flags.test.ts` (defaults + env coercion tests). The comment at `feature-flags.ts:17` describes lifecycle (introduced 8a, removed 8c) but no app code imports `getFeatureFlag("PORTAL_ROLE_COLLAPSE")` yet.

Implication: when Phase 8a wires the flag into the dual-path logic (enum read / DB migration fence), 8c removal is constrained to (a) those 8a-introduced branches, (b) the `FeatureFlagKey` union in `shared/feature-flags.ts:35`, (c) the `DEFAULTS` record entry at `:45`, (d) the 3 test blocks in `tests/feature-flags.test.ts:22,33,55,66,79`. Keep `BOARD_SHUNT_ACTIVE` in place — it has a separate Phase 13 lifecycle.

**Phase 8c total call-site count: ~55** (12 `AdminRole` definitions + 40 client usages + 1 `normalizeAdminRole` call + 2 flag definition lines + ~5 test assertions + residual imports once the canonical type moves).

---

## Sequencing verification vs. 3.3 Q1 backbone

- 2.2 Q1 — "29 endpoints guarded by `requirePortalBoard`." **Verified exactly:** 29 app handler sites at the line numbers listed above.
- 3.3 Q1 — "tenant/readonly collapse into `owner` effective role, `board-member` retained." `server/storage.ts:12697–12708` effective-role derivation matches: `tenant` falls through to `access.role` (identity), `board-member` takes the dedicated branch, owner-plus-board merges. Collapsing the stored enum requires either (a) preserving `tenant` in a separate `occupancy.residentType` column (already exists — `storage.ts:3630`, `5205`, `5396`) and narrowing `portal_access.role` to `owner|board-member`, or (b) retaining `portalAccess.role` wider but deprecating use.
- 5b — feature-flag helper lives at `shared/feature-flags.ts`, currently unused in app code. 8a wiring is the first consumer as planned.

**Plan gaps found:**
1. `AdminRole` duplicates — 8 not 4 (doubled). Covered above.
2. `PortalRequest` — 4 definitions not 1. Dedup effort is larger than the plan implies.
3. `server/storage.ts` has the heaviest `tenant`/`board-member` literal density (47 hits) and was not enumerated in the plan. This file is the true center of gravity for 8a.
4. `script/verify-owner-portal-multi-unit.ts:137` asserts `requirePortalBoard` presence — smoke script must be updated when the middleware retires.
5. `tests/utils/auth-helpers.ts:83` default `portalRole = "owner"` is fine; but tests that pass `"tenant"`/`"readonly"` explicitly (grep reveals none currently) would break silently.

---

## Risk register additions

1. **`server/storage.ts` effective-role surface (Highest risk).** `storage.ts:4136` + `12648` + `12697–12708` produce the `effectiveRole` union `"owner"|"tenant"|"readonly"|"board-member"|"owner-board-member"`. Every portal hub response (`routes.ts:10781`, `11808`) and every client that parses `/api/portal/me` depends on this shape. Collapsing the underlying enum without preserving the derived union is an API break — needs a contract-test harness before migration.
2. **`PortalRequest` 4x duplication (High risk).** 102 usages across 4 files. Dedup must happen as a prerequisite to 8b retype; otherwise drift between files means "retyped" enforcement is partial. The `autopay.ts` export is a ready-made canonical source — hoist it to `server/types/portal-request.ts`.
3. **`AdminRole` 8x duplication (High risk, mechanical).** Every copy is a potential drift point when the role union changes in Phase 14 (Phase 7 already settled the 6 values). Mechanical fix, but touching 12 files in one PR raises conflict risk — sequence behind an interim `shared/roles.ts` export.

---

## Return summary

- **File path:** `/home/runner/workspace/docs/projects/platform-overhaul/implementation-artifacts/phase-8-call-site-audit.md`
- **Phase 8a total call-site count:** ~65 (schema 2 + storage 47 + routes 12 + client 6 + tests 1)
- **Phase 8b total call-site count:** ~140 (29 `requirePortalBoard` endpoints + 16 read-only overlaps + 102 `PortalRequest` refs + 8 null-role client callers)
- **Phase 8c total call-site count:** ~55 (12 `AdminRole` defs + 40 client uses + 1 `normalizeAdminRole` call + flag removal footprint)
- **Top 3 highest-risk sites:**
  1. `server/storage.ts:4136` / `12648` / `12697–12708` — effective-role union derivation.
  2. `PortalRequest` 4-way duplication (`server/routes.ts:762`, `routes/amenities.ts:20`, `routes/autopay.ts:51`, `routes/payment-portal.ts:42`).
  3. `server/routes.ts:15256–15270` — hub visibility with `"readonly"` fallback for null `portalRole`.
- **Sites the plan did NOT anticipate:**
  - 5 extra `AdminRole` duplicates on client (`dashboard.tsx:214`, `election-detail.tsx:32`, `elections.tsx:28`, `governance-compliance.tsx:37`, `global-command-palette.tsx:19`).
  - 3 extra `AdminRole` duplicates on server (`routes/amenities.ts:13`, `routes/autopay.ts:42`, `routes/payment-portal.ts:33`).
  - 3 extra `PortalRequest` duplicates (`routes/amenities.ts:20`, `routes/autopay.ts:51`, `routes/payment-portal.ts:42`).
  - Heavy `tenant`/`board-member` literal usage in `server/storage.ts` (47 hits) not enumerated in the plan.
  - Smoke script assertion `script/verify-owner-portal-multi-unit.ts:137` coupled to `requirePortalBoard` name.
