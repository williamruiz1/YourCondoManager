# Hub-Visibility Rename Migration — Scope Audit

**Scope:** Deferred-from-Phase-4 (1.1) `hubVisibilityLevelEnum` rename. Read-only audit.
**Upstream:** 2.1 Q11 policy LOCKED (decouple from role enums); target vocabulary NOT locked.
**Human task:** PPM `a02f1d92-c5ba-4840-a1f5-0d7c7ac3fb29`. **Trigger:** Wave 8 flagged 1.1 handoff AC 6 ("Small hub-visibility rename migration executed (labels only)") as NOT SMALL.

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

**2.1 Q11 (LOCKED):** Decouple from role enums. Example `public | residents | unit-owners | board-only | operator-only` — "e.g." wording; target vocab is NOT locked, only the policy is.

**1.1 Q4 does NOT define the rename target.** 1.1 Q4 locks page-file `// zone:` / `// persona:` comments. "Small hub-visibility rename migration" appears only in: `1.1-zone-taxonomy-handoff.md` (30, 81, 95), `2.1-role-model-audit.md` (201, 259–262, 284 — policy only), `layer-2-primitives-task.md:48` (AC 9).

⚠️ **FLAG 2:** 1.1 handoff calls this "labels only" — inaccurate. pgEnum rename + data migration + 17 code-site updates is not labels only. 1.1 handoff AC 6 should be struck or rescoped.

⚠️ **FLAG 3:** Target vocabulary ambiguous. Candidates: (i) 2.1 Q11 illustrative `public | residents | unit-owners | board-only | operator-only` (5 values, 1:1); (ii) zone-aligned `public | residents | owners | governance | platform`; (iii) abstract `tier-0 … tier-4`. William must pick before migration starts. Cardinality also open — keep `admin` tier or collapse it? 1:1 mapping preferred to avoid per-row semantic-loss decisions.

---

## 3. Production Data Implications

- `hub_visibility_level` is a **pg enum** — `ADD VALUE` works in-place; removal requires drop+recreate with column re-cast.
- `community_announcements.visibility_level` is `text` — trivially `UPDATE`able, no type alteration.
- **Row counts unknown.** ⚠️ **FLAG 4:** William runs `SELECT visibility_level, COUNT(*) FROM hub_map_issues GROUP BY 1` plus same on `community_announcements`. Volume sets dual-write window length.
- **1:1 mapping feasible** if target keeps 5 values. Dropping to 4 (e.g., collapse `admin` into `board-only`) is a policy decision, not a data one.
- **NULLs** in `community_announcements.visibility_level` read as public-ish today (`routes.ts:15091`: `isNull || eq "public"`). Migration must preserve that read path or backfill NULLs explicitly.

---

## 4. Behavioral Impact

The enum gates two surfaces: community announcements (`/api/hub/:identifier/public` + authed portal endpoint) and hub map issues. Hierarchy: `public` (anonymous read) → `resident` (any portal role) → `owner` (`owner | board-member`) → `board` (`board-member` or `portalHasBoardAccess`) → `admin` (never pushed into bucket; operator-write-only).

Pure label rename does not change runtime behavior, but two couplings matter:

1. `routes.ts:15268–15270` reads **portal-role string literals** (`tenant | owner | board-member | readonly`). Phase 8a collapses those role strings. The hub-visibility rename cannot ship independently of 8a without a rebase conflict.
2. `admin` tier is unreachable via portal code paths — only operator-side UI writes it. If retained, operator-write at `routes.ts:15020` must continue writing the renamed equivalent; otherwise the value is dead weight.

⚠️ **FLAG 5:** `routes.ts:15091` exposes `"public"`-visibility rows on an **anonymous public endpoint** (rate-limited, no auth). The `visibilityLevel` string appears verbatim in the public JSON response (`routes.ts:15319–15337`). Any change to the `"public"` literal is a public-API break. No OpenAPI/tRPC spec formalizes the contract, but partner embeds, portal previews, or search crawlers keyed on the string would regress silently. William must confirm no external consumer before the literal changes.

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

- **Not absorbable into 1.1.** 1.1 Q4 scope is `// zone:` / `// persona:` page-file comments — zero shared file touches with the enum migration. Handoff-AC-6 was a drafting error.
- **Not Phase 15.** Phase 15 ships Communications zone UI; coupling a pgEnum+data migration to it risks blocking the zone landing on a prod-data audit.
- **Not deferrable post-overhaul.** 2.1 Q11 SPEC LOCKED. Layer 2 primitives AC 9 (`layer-2-primitives-task.md:48`) lists the rename as a layer-2 exit gate. Deferral breaks 2.1 lock status.
- **Standalone 1.5** owns: target-vocab decision doc, its own feature flag, 3-phase migration, single exit gate. Sequences cleanly after Phase 8a without re-opening 1.1 or blocking Phase 15.

**Sequencing:** Post-8a, pre-Phase-15. Dependencies: 8a complete, 2.1 Q11 vocab locked (⚠️ FLAG 3), prod-data audit complete (⚠️ FLAG 4).

**Amendments required:** strike 1.1 handoff AC 6; point 2.1 Q11 note at new 1.5 module; record scope split in 1.1 decision log.

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
