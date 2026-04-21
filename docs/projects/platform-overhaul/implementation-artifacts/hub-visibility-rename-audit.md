# Hub-Visibility Rename Migration — Scope Audit

**Scope:** YCM Platform Overhaul — deferred-from-Phase-4 (1.1) `hubVisibilityLevelEnum` rename.
**Status:** Read-only audit. No schema, data, or code modified.
**Upstream gate:** 2.1 Q11 policy LOCKED ("decouple hub-visibility vocabulary from role enums"); target vocabulary NOT formally locked.
**Human task:** PPM `a02f1d92-c5ba-4840-a1f5-0d7c7ac3fb29`.
**Trigger:** Wave 8 agent surveyed 1.1 handoff AC 6 ("Small hub-visibility rename migration executed (labels only)"), flagged as NOT SMALL — this audit produces the scope map for William's resolution session.

---

## 1. Current State

### Enum definition
`/home/runner/workspace/shared/schema.ts:2602`
```ts
export const hubVisibilityLevelEnum = pgEnum("hub_visibility_level",
  ["public", "resident", "owner", "board", "admin"]);
```
**5 enum values.**

### Columns typed by the enum
- `/home/runner/workspace/shared/schema.ts:2716` — `hubMapIssues.visibilityLevel` (enum-bound, default `"board"`).
- `/home/runner/workspace/shared/schema.ts:1395` — `communityAnnouncements.visibilityLevel` (**plain `text()` — NOT enum-bound**, NULL permitted).

⚠️ **FLAG 1:** The 2.1 Q11 audit says the rename hazard is in `hubVisibilityLevelEnum`, but `communityAnnouncements` uses `text("visibility_level")` — a string column that stores the same vocabulary without DB-level constraint. The rename scope must cover BOTH columns or the decoupling is incomplete; a pg enum rename alone would not touch `community_announcements.visibility_level` rows.

### Call sites (verified by Grep)

**`shared/schema.ts`** — 2 hits (enum def + column declaration).

**`server/routes.ts`** — 10 hits: write `"public"` at 15020, write `"board"` at 15356, public-endpoint read filter at 15091, portal-endpoint bucket build at 15267–15270 (4 hits coupling to portal-role strings `tenant | owner | board-member | readonly`), portal-endpoint reads at 15281–15282 and 15304. (Wave 8 reported 7; actual 10.)

**`client/src/pages/community-hub.tsx`** — 7 hits: type declaration at 79; form state at 871; load at 895; submit at 969; `visibilityLabels` record at 990–996 (`public/resident/owner/board/admin` → display strings); `<Select>` with 5 `<SelectItem>` options at 1057–1065; badge render at 1154–1155. (Wave 8 reported 6; actual 7.)

**Other references:** `grep -rn "hubVisibilityLevelEnum"` returns zero imports outside `shared/schema.ts` — all call sites use string literals directly. No test file exercises the enum values.

### Total call-site count
**19 touch points** (2 schema + 10 server + 7 client). Matches Wave 8's ~20 estimate.

---

## 2. Target Vocabulary

**2.1 Q11 resolution (LOCKED):** Decouple. Example given: `public | residents | unit-owners | board-only | operator-only`. The word "e.g." matters — the target vocabulary is NOT locked, only the decoupling policy is.

**1.1 Q4 does NOT define the rename target.** 1.1 Q4 locks the `// zone:` + `// persona:` comment block on page files. The "small hub-visibility rename migration" appears only in:
- `1.1-zone-taxonomy-handoff.md:30, 81, 95` (handoff doc — "one small hub-visibility rename migration")
- `2.1-role-model-audit.md:201, 259–262, 284` (2.1 Q11 — policy-locked, target vocab illustrative)
- `layer-2-primitives-task.md:48` (AC 9 — tracked under Layer 2 bundle)

⚠️ **FLAG 2:** The 1.1 handoff describes this as a "labels only" migration, implying low scope. That is inaccurate — a pgEnum rename plus data migration plus 17 code-site updates is not "labels only." The 1.1 handoff AC 6 text should be amended to either (a) remove the AC and move it to a dedicated module, or (b) explicitly scope it to "Phase HV-1 only — schema addition + flag plumbing."

⚠️ **FLAG 3:** Target vocabulary is ambiguous. Candidates:
- **2.1 Q11 example:** `public | residents | unit-owners | board-only | operator-only` (5 values, 1:1 map).
- **Zone-aligned option:** `public | residents | owners | governance | platform` (maps to 1.1 zones for Communications hub).
- **Numeric-tier option:** `tier-0 | tier-1 | tier-2 | tier-3 | tier-4` (fully abstract, zero overlap risk).

William must pick one before migration can start. Cardinality must also be confirmed — is `admin` (distinct from `board`) still semantically needed, or does it collapse given post-Phase-8a portal collapse? Prefer keeping 5 values 1:1 to avoid semantic-loss questions; any reduction to 4 creates a many-to-one migration with a policy decision per row.

---

## 3. Production Data Implications

- `hub_visibility_level` is a **Postgres enum type** (pg declarative) — adding values requires `ALTER TYPE ... ADD VALUE`, removing values requires enum drop+recreate with column re-cast.
- `community_announcements.visibility_level` is `text` — trivially updatable via `UPDATE` statement, no type alteration needed.
- **Row counts unknown.** ⚠️ **FLAG 4:** William must run an audit query: `SELECT visibility_level, COUNT(*) FROM hub_map_issues GROUP BY visibility_level;` and same for `community_announcements`. Data volume determines dual-write window length.
- **1:1 mapping is feasible** if the selected target keeps 5 values. **Semantic loss** arises only if target has 4 values (e.g., collapsing `admin` into `board-only`) — a policy call, not a data call.
- **Existing NULL rows** in `community_announcements.visibility_level` are treated as "public-ish" in `routes.ts:15091` (`isNull || eq "public"`) — the migration must preserve this NULL-tolerant read path or explicitly backfill NULLs first.

---

## 4. Behavioral Impact

The enum gates two surfaces:

**Community announcements (`/api/hub/.../public` and `/api/hub/portal/...`)**
- `public` — rendered on anonymous public hub endpoint (no auth).
- `resident` — visible to portal roles `tenant | owner | board-member | readonly`.
- `owner` — visible to `owner | board-member`.
- `board` — visible to `board-member` or `portalHasBoardAccess`.
- `admin` — never pushed into `visibilityLevels` array (only operator-side UI can select it; effectively operator-only).

**Hub map issues (`/api/hub/portal/map/issues`)**
- Same hierarchy. Default on creation is `"board"` (`routes.ts:15356`).

**Runtime behavior:** Pure label rename does not change behavior. However:
- `routes.ts:15268–15270` uses **portal-role string literals** (`tenant`, `owner`, `board-member`, `readonly`) in the bucket computation. Post-Phase-8a these role strings collapse — the hub-visibility rename must NOT be attempted in isolation from 8a, because the bucket logic is coupled to the old portal-role vocabulary.
- The `admin` visibility tier is unreachable via portal-role code paths today (no branch pushes it). If kept in the target vocab, the operator-write path (`routes.ts:15020`) must continue writing it; otherwise the value is dead.

⚠️ **FLAG 5:** The portal-public endpoint (`routes.ts:15091`) exposes `"public"` visibility data with no auth. Any rename that changes the literal `"public"` changes the anonymous-read contract. An external consumer (partner embed, search crawler, portal preview) keyed on `visibility_level === "public"` would break. William must confirm no external consumer exists before literal change.

**API consumer audit:** No OpenAPI/spec file exports the enum; no tRPC contract tested; but the public hub JSON response includes announcement rows verbatim — the `visibilityLevel` string IS in the public response shape at `routes.ts:15319–15337`. Treat as a public-API breaking change until proven otherwise.

---

## 5. Proposed Migration Plan

Model after `PORTAL_ROLE_COLLAPSE` (`shared/feature-flags.ts:35, 45`). New flag `HUB_VISIBILITY_RENAME`, default OFF, removed after HV-3.

**HV-1 — Schema additive.** `ALTER TYPE hub_visibility_level ADD VALUE` per target string (pg enums can add in-place but not drop). Decide: convert `community_announcements.visibility_level` to the enum type (backfill NULLs first) OR keep `text` with zod validation. Ship flag OFF. Reversible.

**HV-2 — Data + dual-read.** `UPDATE` statements map old→new values on both tables. Server: flag-ON reads union old+new via `inArray`; writes target vocab only. Client: flag-gated Select options; `visibilityLabels` covers both sets. Deprecation window length = f(row count per ⚠️ FLAG 4).

**HV-3 — Cutover.** Drop-and-recreate enum (rename old, create new with target values, `ALTER COLUMN ... USING` cast, drop old). Update all 17 call sites to target literals. Remove flag. Update `visibilityLabels`, Select, and `routes.ts:15267–15270` bucket logic.

**Dependency:** HV-* must run after Phase 8a — the 15268–15270 bucket reads `portalAccessRoleEnum` strings that 8a collapses. Pre-8a attempt creates a rebase conflict.

---

## 6. Scope Decision Recommendation

**Recommended: (a) Standalone module — new 1.5 Hub Visibility Rename.**

Rationale:
- **Not absorbable into 1.1.** 1.1 Q4 scope is `// zone:` / `// persona:` page-file comments. The rename migration has no shared work surface, no shared file touches, and no shared acceptance criterion with 1.1 Q4. Handoff-AC-6 was a drafting error.
- **Not appropriate for Phase 15 Communications zone landing.** Phase 15 ships Communications zone UI; a pgEnum+data migration is infrastructure plumbing, not zone landing. Coupling them risks blocking Phase 15 on a prod-data audit.
- **Not deferrable post-overhaul.** 2.1 Q11 is SPEC LOCKED. Layer 2 primitives task AC 9 already includes this rename as a layer-2 exit gate (`layer-2-primitives-task.md:48`). Deferring post-overhaul breaks 2.1 SPEC LOCKED status.
- **Standalone 1.5 is the right wrapper** because: (i) it has its own decision doc for target-vocabulary resolution, (ii) it has its own feature flag, (iii) it has a single-phase 3-step migration with its own exit gate, and (iv) it can be sequenced after Phase 8a (the portal-role collapse) cleanly without re-opening 1.1 or blocking Phase 15.

**Sequencing:** Run as a post-8a, pre-Phase-15 module. Dependencies: Phase 8a complete (portal-role collapse), 2.1 Q11 vocabulary locked (⚠️ FLAG 3), prod-data audit complete (⚠️ FLAG 4).

**Amendment required:** 1.1 handoff AC 6 should be struck; 2.1 Q11 implementation note should point to the new 1.5 module; 1.1 decision doc Decision Log should record the scope split.

---

## Summary

| Item | Count |
|---|---|
| Enum values | 5 |
| Columns touched | 2 (enum-bound + text) |
| Schema call sites | 2 |
| Server call sites | 10 |
| Client call sites | 7 |
| **Total touch points** | **19** |
| ⚠️ Flags for William | **5** |
