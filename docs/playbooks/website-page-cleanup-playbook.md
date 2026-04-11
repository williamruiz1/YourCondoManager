# Website / Dashboard Page Cleanup Playbook

> A platform-agnostic information architecture audit playbook. Portable across products, frameworks, and agent platforms.
>
> **Origin:** distilled from the Pocket PM IA audit (spec: `docs/specs/ia-audit-spec.md`, runbook: `docs/runbooks/ia-audit-ppm-db-mirror.md`). Every product-specific assumption has been lifted out. What remains is the method.

---

## 0. What this is

A reusable protocol for auditing and restructuring the information architecture of any web product that has grown past the point where "add a page when you need one" is working. It gives you:

- A **mental model** (zones + taxonomy + personas) for thinking about what every page is *for*
- A **scoring rubric** (8 dimensions) for grading each page objectively
- A **verdict vocabulary** (9 verdicts) so auditors can't reinvent their own answers
- A **6-phase execution plan** that's parallelizable across sub-agents
- A **dispatch template** you can paste into another agent on another platform
- **Anti-patterns** that are easy to fall into and hard to recover from

The playbook is designed to be run by an agent (or a team of sub-agents) under the direction of a human reviewer. It does not assume any specific codebase, framework, routing system, or state management — only that you have a set of discoverable "page" units and some concept of navigation.

## 0.1 When to use this

Run this playbook when **at least three** of these are true:

1. The nav has grown to ≥30 items and the PM/owner can't name the category of each from memory
2. You can point to concrete duplicates — two pages with similar labels doing similar work
3. You have "orphan" pages: files on disk that aren't reachable from the nav (or are only reachable via deep links you forgot about)
4. At least one page exists that you click into and immediately feel "this doesn't deliver what its label promised"
5. Admin or operator-only surfaces are leaking into customer-facing sections
6. You are about to make a tier/pricing/packaging change that depends on the pages meaning what they say they mean

If fewer than three are true, you probably don't need this — you need a single `PATCH` session on the one page that's bugging you.

## 0.2 What this playbook is NOT

- **Not a re-platforming exercise.** Framework stays, component library stays, URL structure stays until Phase 6 proposes specific moves.
- **Not a tier/pricing packaging tool.** The audit records a cognitive-load *hint* per page (rubric dimension 8) but does not decide tier gates. Tier-scaling is the exercise this playbook unblocks.
- **Not a code refactor.** Auditors in Phases 1–4 never modify files. Moves only happen in Phase 6, after a human accepts the proposal.
- **Not a new-feature exercise.** The audit may propose new "hub" pages where merges land, but it does not invent new functionality.

---

## 1. Prerequisites

Before you dispatch Phase 1, you need these in hand. If any are missing, stop and produce them first.

### 1.1 Ground truth inventory

You must know **every page file the product contains** — not just the ones in the nav. The method varies by framework but the output is always the same: a list.

| Framework | How to get the list |
|---|---|
| Next.js App Router | `find <app-dir>/ -name page.tsx -o -name page.jsx` |
| Next.js Pages Router | List files under `pages/` excluding `_app`, `_document`, `api/**` |
| Remix | `app/routes/*.tsx` (flat) or `app/routes/**/route.tsx` (nested) |
| SvelteKit | `src/routes/**/+page.svelte` |
| Vue + Nuxt | `pages/**/*.vue` |
| React Router (SPA) | Every `<Route path="...">` in the router config |
| Static site (Astro, 11ty, Hugo) | Content directory listing |
| Django | `urls.py` walk from the root include |
| Rails | `config/routes.rb` parsed |

You also need the **nav tree** — the list of paths actually linked from the product's sidebar, top-nav, or equivalent chrome. This is distinct from the page inventory. The delta between the two is your **orphan list**.

### 1.2 A short problem statement

Before you write the spec (§3), the human owner writes 3–8 bullet points naming **concrete symptoms** they want the audit to address. Examples:

- "Duplicate pages X and Y with different labels doing the same thing"
- "Orphan pages I forgot existed"
- "Page Z has no header stats — the one thing I'd want at a glance"
- "Operator-only settings are bleeding into customer-facing nav"
- "Nav scroll position resets on every navigation" *(flag as cross-cutting — not in audit scope but don't lose it)*

Specificity matters. "The nav feels cluttered" is not actionable. "Five pages under Setup should be in Admin" is.

### 1.3 Existing architectural invariants the audit must respect

List the non-negotiable rules that any restructure proposal must not break. Common examples:

- "Every feature ships as API + UI + CLI — a page kill cannot orphan the API route unless we also kill the API"
- "URL structure has public SEO contracts — don't break indexed paths"
- "Certain routes are embedded in external partner sites — renames need a 301 plan"
- "Permission boundaries enforced by middleware — moves must not break them"
- "Accessibility compliance — any new hub page inherits the same audit requirements"

Your Phase 5 proposal has to cross-check against this list explicitly.

### 1.4 Planning persistence surface

You need somewhere to record work that this audit creates. Examples from the source project:

- A **workstream tracker** (markdown table, issue tracker, project board)
- A **spec directory** for the audit's own artifacts
- A **state file** or inventory that tracks page counts, statuses, known issues

If your product doesn't have these, make them before Phase 0. The audit will produce artifacts across all of them.

---

## 2. The Three-Zone Mental Model

The core insight of this playbook: **users don't navigate by section, they navigate by intent**. Your sections are nav groupings; your zones are intent groupings. They should be congruent, but very often they are not, which is why audits find so much mis-placement.

### 2.1 The canonical three-zone split

This split works for most B2B and prosumer products. You may customize it (§5.1), but start here.

**Zone 1 — Day-to-day work loop.** What a user opens the product to *do*. The core value proposition in motion. Widgets, dashboards, the primary creation/review/monitoring flows. High repeat traffic. Always visible. Biggest visual weight in the sidebar or nav.

**Zone 2 — Account-level admin.** Always available to the customer, but not part of the daily loop. Setup, connections, integrations, guides, reference docs, account settings, billing. Task-driven visits. Think of it like the "Settings" gear in a consumer app — you go there to *configure*, not to *work*.

**Zone 3 — Operator-only admin.** The surfaces your *own team* uses to run the platform: tenant management, platform health, feature flag toggles, internal telemetry, cross-customer analytics. **Invisible to customers by default.** Exposure of Zone 3 to a customer tier is either a tier gate decision or a bug.

### 2.2 How zones relate to sections

Zones are an audit construct. Sections are a nav construct. After the audit you *may* reshape the nav to make the zones visible (e.g. Zone 1 items at the top with biggest weight, Zone 2 in a collapsed "Settings" drawer, Zone 3 under a permission-gated route), but the audit itself doesn't care what the nav looks like.

### 2.3 Why the split matters for audit pass structure

The most important operational boundary is **Zone 2 ↔ Zone 3** — customer-visible vs. not. Audits are run in **two passes**:

- **Pass 1 = Zone 1 ∪ Zone 2** (everything a customer can see)
- **Pass 2 = Zone 3** (operator-only)

Pass 1 is the larger and more contentious audit. Pass 2 absorbs handovers from Pass 1 (pages tagged `DEMOTE-ADMIN`) plus existing operator-only pages.

### 2.4 Hard constraint: operator invisibility

Whatever else your audit produces, Zone 3 must be genuinely invisible to non-operator users, not just visually de-emphasized. The *shape* of that invisibility (role-gated sidebar section, separate admin subroute, separate subdomain, separate app entirely) is a Phase 5 decision. The principle is locked before Phase 1.

---

## 3. Page Taxonomy

Your taxonomy is a small, stable, exclusive set of **category tags** — every page gets exactly one. The taxonomy is the *scoring* construct. It is not the nav. Pages with the same category may end up in different nav locations; pages in the same nav section may end up with different categories. That's fine.

### 3.1 Taxonomy design rules

1. **Small.** 8–15 categories total. If you have 30, you have no taxonomy — you have a list.
2. **Stable.** Don't invent new categories during the audit. If a page doesn't fit, that's information.
3. **Exclusive.** Every page gets exactly one tag. No multi-tagging. A page that "belongs in two" is a sign that the page itself is doing two things and should probably be split or one of the concerns widgetized.
4. **Zoned.** Each category belongs to exactly one zone. A category that spans zones (e.g. "Security" with both customer-facing and operator-only pages) must be *split* into a customer-half and operator-half before the audit runs.
5. **Named from user intent, not from product features.** "Command Center" > "Dashboards". "Concept Creation" > "Ideation Tools". The name should answer "what is the user *doing* when they land here?"

### 3.2 Worked example (from Pocket PM)

Not prescriptive — use this as calibration, then derive your own.

**Zone 1 — Day-to-day (5 categories):** Command Center · Concept Creation · Planning Artifacts · Execution Control · Monitoring, Health & Quality

**Zone 2 — Customer-account admin (5 categories):** Customer Security & IP · Customer Knowledge · Connect & Export · Product Setup · Guides & Reference

**Zone 3 — Operator-only admin (3 categories):** Platform Security · Platform Learning Loop · Platform Admin

Notice: Security and Knowledge each appear in Zone 2 and Zone 3 (a customer half and an operator half). That split is deliberate and was locked before Phase 1.

### 3.3 How to derive your own taxonomy

1. Write down your **problem statement** bullets from §1.2.
2. For each bullet, ask: "what is the user-intent category this bullet lives in?" Don't look at your nav — look at *what the user is trying to do*.
3. Group similar intents. Aim for 8–15 groups.
4. Assign each group to one zone.
5. For any group that clearly has both a customer-facing and operator-only half, **split** it into two. Don't leave it spanning zones.
6. Name each group from user intent, not feature names.
7. Stop. This is your taxonomy.

Do this *before* dispatching Phase 1 auditors. If the taxonomy is wrong or incomplete, auditors will either refuse to classify or invent their own categories. Either failure mode wastes a session.

---

## 4. Persona List

Each page gets one **primary persona** — the user it primarily serves. A secondary persona may be noted but one must be picked.

### 4.1 Canonical persona tags

Customize freely but start here:

| Tag | Description |
|---|---|
| `primary-customer` | The core paying user the product was built for |
| `secondary-customer` | An adjacent persona (e.g. a non-developer user of a developer tool) |
| `end-user` | Someone the customer serves (e.g. a customer's customer) — pages tagged here typically belong to embed/share flows |
| `agent-or-automation` | The page is primarily machine-read (bootstrap payloads, structured exports, API explorer) |
| `operator` | Your own team — pages tagged here are Zone 3 by definition |

### 4.2 Persona ↔ zone consistency rule

`operator` ⇒ Zone 3 always. Any page with `operator` primary persona that is NOT in Zone 3 is a placement defect — either the persona is wrong or the zone is wrong. Pass-1 auditors must flag this.

---

## 5. Customizing the model for your product

The three-zone / 13-category / 5-persona structure above is a starting point, not a prescription. Adjust as follows.

### 5.1 Different zone counts

- **Two zones** (customer + operator, no account-admin separation) works for very simple products. The audit collapses to a single pass.
- **Four zones** works when you have a meaningful split inside the day-to-day loop (e.g. a consumer face + a creator face for a marketplace). Rare but valid.
- **More than four zones** means your product is probably several products and should be audited separately.

### 5.2 Different taxonomy sizes

Don't go below 5 categories (you lose resolution) or above 20 (the set isn't small enough to be stable). Sweet spot is 8–15.

### 5.3 Different persona lists

Match the product. A developer tool adds `developer`. A marketplace adds both sides of the market. A government service adds role-based personas. Five tags is a reasonable upper bound before the list becomes noise.

### 5.4 Product-specific constraints

Add a `C1..CN` constraint list to your spec (see §3 of the spec template in Appendix A) that captures architectural rules the audit must preserve. Typical entries:

- **C1 — Operator invisibility.** (Always include this — it's universal.)
- **C2 — [Your triplet / invariants rule].** What surfaces must ship together.
- **C3 — [Your planning persistence rule].** What artifacts must be updated alongside any change.
- **C4 — [Your canonical UI pattern].** If you have an established "hub with tabs" or "master-detail" pattern that new merge targets should follow.
- **C5 — No page is moved in Phase 1–4.** (Always include this.)
- **C6 — Orphan handling rule.** A page with no nav entry is not auto-killed — it may mean "surface." Phase 2 decides per page.

---

## 6. Scoring Rubric

Each audited page produces one **scorecard row** with these 8 dimensions plus a free-text gaps field. This is the *only* shape a Phase 1/2/4 auditor is allowed to return.

| # | Dimension | Values | Purpose |
|---|---|---|---|
| 1 | **Purpose** | Free text, one sentence, ≤140 chars: `"This page exists to {verb} {object}."` | If the auditor cannot write this in one sentence, that is itself a smell and must be flagged in the gaps field. |
| 2 | **Primary persona** | One tag from §4 | Drives zone assignment; operator ⇒ Zone 3 always. |
| 3 | **Category** | One tag from §3 | Exactly one. No multi-tagging. |
| 4 | **Zone** | `zone-1` / `zone-2` / `zone-3` | Derived from category but recorded separately so zone disputes become explicit rather than hidden. |
| 5 | **Placement fit** | `correct` / `wrong-section` / `wrong-side` / `wrong-zone` | `wrong-section` = right zone, wrong nav group. `wrong-side` = customer when should be operator or vice versa. `wrong-zone` = placed in the wrong zone entirely. |
| 6 | **Content fulfillment** | `complete` / `thin` / `broken` | `thin` = page exists but content doesn't deliver on its stated purpose. `broken` = feature-flagged off, placeholder, or unreachable state. |
| 7 | **Consolidation candidacy** | One verdict from §7 | The auditor's proposed action. |
| 8 | **Cognitive load** | `low` / `med` / `high` | Hint only. Feeds the next tier-scaling / packaging exercise. Does not drive this audit's verdicts. |

Plus:

- **Gaps field** (free text): bulleted list of specific content fulfillment gaps. Every `thin` or `broken` rating needs at least one bullet here explaining what's missing.
- **Goal-alignment note**: which problem-statement bullet (§1.2) this page advances. A page that advances none is a `KILL` or `DEMOTE-ADMIN` candidate by default.

### 6.1 Why 8 dimensions

Each dimension catches a specific failure mode:

- **Purpose** catches the "what even is this page" case — if you can't write one sentence, the page has a real problem
- **Persona + category + zone** catch placement problems *semantically*, before anyone looks at the nav
- **Placement fit** catches placement problems *structurally*, against the current nav
- **Content fulfillment** catches the "widget masquerading as a page" case
- **Consolidation candidacy** forces the auditor to propose an action
- **Cognitive load** feeds the next audit downstream

Skipping dimensions (or adding new ones) is how auditors go off-spec. Don't.

---

## 7. Verdict Vocabulary

The auditor returns **exactly one verdict** per page from this closed set of 9. Inventing new verdicts is an anti-pattern (§9).

| Verdict | Meaning | When to use | Example |
|---|---|---|---|
| `KEEP` | Page is healthy. No action. | Purpose clear, placement correct, content fulfills purpose. | A well-functioning dashboard. |
| `PATCH` | Keep page, fix specific gaps listed in scorecard. | Placement correct but content is `thin` or has small defects. | A feature tree page missing its stats header. |
| `MERGE-AS-TAB` | Becomes a tab under a named parent page. | Close sibling of an existing page; no standalone value. | Three "security" pages → one hub with tabs. |
| `MERGE-INTO-HUB` | Folds into a new or existing hub alongside siblings. | Multi-page concept sprawl where the hub itself may not yet exist. | Four monitoring pages → one new `/monitoring` hub. |
| `WIDGETIZE` | Kill the page. Content becomes widget(s) on a named parent. | Page is widget content masquerading as a nav destination. | A "my progress" page with no content that bounces to another page. |
| `RENAME-MOVE` | Change label and/or nav section without merging. | Page is fine; its name or location is wrong. | An "Add Product" page that's really a button, or a page in the wrong nav section. |
| `DEMOTE-ADMIN` | Move to Zone 3. Pass-1 auditors tag; Pass-2 absorbs. | Operator-only surface currently in a customer section. | Platform-owner telemetry leaking into customer Setup. |
| `ORPHAN-SURFACE` | Page exists on disk but not in nav. Decision: add to nav, with target section. | Discovered in the orphan sweep. | A core concept page you forgot to link. |
| `KILL` | Delete the page entirely. API/CLI coordination handled separately per C2. | No purpose served, no path to recovery. | A deprecated docs page. |

### 7.1 Required metadata per verdict

Every non-`KEEP` verdict must include:

1. A **target** (parent page, hub name, nav section, new URL, etc.)
2. A **rationale** (≤1 sentence, grounded in the scorecard row)

A verdict without a target is meaningless. Phase 3 reconciliation will reject it.

### 7.2 Verdict precedence

If two verdicts seem to fit, resolve in this order: `KILL` > `DEMOTE-ADMIN` > `WIDGETIZE` > `MERGE-INTO-HUB` > `MERGE-AS-TAB` > `RENAME-MOVE` > `PATCH` > `KEEP`. "Bigger surgery wins" — if something could be `PATCH` or `MERGE-AS-TAB`, pick `MERGE-AS-TAB` so the reconciliation phase sees the option.

---

## 8. Phased Execution Plan

Six phases. A human review gate between Phase 5 and Phase 6 is **mandatory** — no automated execution of moves.

### Phase 0 — Spec alignment

**Output:** a locked spec document containing: problem statement, goals, non-goals, constraints, zones, taxonomy, personas, rubric, verdict vocabulary, phased plan, and appendices (A = current nav dump, B = orphan candidates, C = worked scorecard examples).

**Sub-agent model:** 0 sub-agents. This is done by the human + driving agent in a single alignment session.

**Gate:** human review before Phase 1 dispatch.

Use the spec template in Appendix A of this playbook.

### Phase 1 — Pass 1 auditors (Zones 1 + 2)

**Input:** the locked spec + Appendix A (current nav dump) + Appendix B (orphan list, Zone 1/2 portion).

**Sub-agent model:** N parallel section auditors, one per current nav section that contains customer-facing content. Each auditor:

- Reads every page file in its assigned section (shallow — component tree + data fetched, not every line)
- Fills a scorecard row per page against §6
- Returns a verdict per §7
- Flags `DEMOTE-ADMIN` handovers in a dedicated section of its output
- Does NOT move pages, rename files, or modify anything
- Holds <20 pages in context (this is why you split by section — each sub-agent's context stays focused)

**Output:** a markdown file per auditor with a single table. A canonical concatenated file (one `## Section: <name>` block per auditor) is produced by the driving agent at the end of the phase.

**Failure modes to watch:**

- An auditor invents a new verdict → reject, re-dispatch with a stricter briefing
- An auditor multi-tags a category → reject, re-dispatch
- An auditor audits pages outside its section (scope creep) → re-dispatch
- An auditor returns a verdict without a target → re-dispatch

### Phase 2 — Orphan sweep

**Input:** Appendix B (every page file not in nav).

**Sub-agent model:** 1 auditor. Claims every orphan not already covered by Phase 1 (some orphans are sub-routes of Phase-1 pages — those get handled in Phase 1 alongside their parent).

**Output:** one file with `ORPHAN-SURFACE` or `KILL` verdicts per orphan. Every verdict still needs a target and rationale.

**Critical:** do a **fresh disk listing** at Phase 2 start, not just the Appendix B snapshot. Appendix B is a starting point, not authoritative — the disk is authoritative. Any page on disk that is neither in the nav nor in Phase 1 coverage must get a Phase 2 verdict.

### Phase 3 — Coordinator reconciliation (customer side)

**Input:** Phase 1 + Phase 2 outputs.

**Sub-agent model:** 1 coordinator agent. Its job:

- Reconcile duplicate-concept handling across auditors (e.g. Auditor A tagged a page `merge-into-hub` with target X, Auditor B tagged its sibling `merge-as-tab` with target Y — do the two targets agree or conflict?)
- Resolve category disputes where two auditors tagged similar pages differently
- Draft the proposed Zone 1 + Zone 2 nav tree from the reconciled verdicts
- List cross-section merges that need a new hub page
- Produce the `DEMOTE-ADMIN` handover list for Phase 4
- Flag any places where Phase 1 or Phase 2 output is internally inconsistent (e.g. a `WIDGETIZE` verdict whose target doesn't exist in any Phase 1 auditor's scope)

**Output:** one file containing the proposed customer nav tree and new-hub list.

### Phase 4 — Pass 2 auditor (Zone 3)

**Input:** existing operator-only pages (whatever your equivalent of `/admin/*` is) + Phase 3's `DEMOTE-ADMIN` handover list + Appendix B's Zone 3 orphans.

**Sub-agent model:** 1 platform-admin auditor. Applies §3 Zone 3 categories + §6 rubric to every Zone 3 page.

**Output:** one file containing the proposed Zone 3 nav tree.

### Phase 5 — IA restructure proposal

**Input:** Phases 1–4 outputs.

**Sub-agent model:** 1 coordinator (may be the same agent as Phase 3). Produces the final proposal:

- **Complete new nav tree** across all zones
- **Per-page action list** — ordered migration plan, grouped by dependency
- **New hub pages** — spec stubs for each new hub (purpose, tabs, data sources)
- **Renames and moves** — full list with before/after paths
- **Kill list** — pages to delete, with notes on API/CLI coordination per your constraints
- **Implementation decisions still open** — specifically, how Zone 3 is hidden (per C1) — permission-gated sidebar, separate admin subroute, subdomain, or separate app
- **Risk section** — what breaks, what needs tests, what needs deprecation warnings, what needs URL redirects

**Output:** a proposal document.

**GATE:** Human review required. **No Phase 6 work begins until the proposal is explicitly accepted.** If the human rejects or requests changes, iterate on Phase 5 (not Phase 1) — the audit data is already sound; it's the proposal shape that needs work.

### Phase 6 — Execute

**Input:** the accepted Phase 5 proposal.

**Scope:** actual page moves, merges, deletions, nav rewrite. Follows your project's standard change protocol (branch naming, CI, review, deployment). Executed in dependency order per the proposal's migration plan, ideally across multiple sessions.

**Output:** shipped restructure. Each session's handoff records what moved and why.

---

## 9. Anti-Patterns

Every audit fails the same ways. The briefing template (§10) forbids all of these explicitly. The driving agent re-dispatches any sub-agent that violates one.

1. **Multi-tagging categories.** "This page is both Planning and Execution." No — pick one. If it truly does two things, that's a sign the page should be split, and *that* is the verdict: `WIDGETIZE` one concern, `PATCH` the remaining concern.

2. **Verdicts without targets.** `WIDGETIZE` into *what*? `MERGE-INTO-HUB` under *which hub*? Every non-`KEEP` verdict must name a target or it's unusable.

3. **Scope creep across sections.** A Phase 1 section auditor MUST NOT audit pages outside its section, even if it notices problems there. If it spots a cross-section concern, it goes in a "cross-refs" note at the bottom of the output — not in the scorecard table.

4. **Inventing new verdicts.** If the 9 verdicts don't fit, the problem is the scorecard, not the vocabulary. Almost always it's a case of multi-tagging (the auditor is trying to say two things at once).

5. **Audit followed by auto-move.** No. Phase 5 produces a *proposal*. Phase 6 executes it *after human acceptance*. Skipping the gate is how audits turn into disasters.

6. **Writing a verdict before writing the purpose sentence.** Dimension 1 first. If you can't state the purpose, you don't understand the page well enough to verdict it.

7. **Calling something `KEEP` because it's familiar.** Run the full rubric. `KEEP` means "scored `correct` + `complete` on every dimension." Familiar ≠ healthy.

8. **Saving a stale orphan list from Phase 0 and treating it as canonical in Phase 2.** Re-list from disk at Phase 2 start. Files drift. Your Appendix B is a hint, not a contract.

9. **Letting Phase 3 silently rename categories to resolve disputes.** If two auditors tagged similar pages differently, the coordinator must *flag* it as a taxonomy ambiguity, not quietly pick one. Taxonomy changes during the audit need the human owner's explicit sign-off.

10. **Taxonomy drift during the audit.** The taxonomy locks at Phase 0. If Phase 1 auditors find pages that don't fit, that's signal the taxonomy needs revision — which requires going back to the human and re-locking, not ad-hoc patching.

---

## 10. Auditor Dispatch Template

Copy-paste this for each Phase 1 / 2 / 4 sub-agent. Fill in the placeholders. This is the template that goes to the sub-agent — the driving agent should never hand over the full playbook.

```
You are the IA auditor for section "{SECTION_NAME}" of {PRODUCT_NAME}'s
{SURFACE_NAME — e.g. "dashboard", "app", "admin panel"}.

Context files to read (and ONLY these):
- {PATH_TO_SPEC} — especially the zones, taxonomy, rubric, verdict sections
- {PATH_TO_NAV_DEFINITION} — the current nav, which defines your section
- Each page file in your assigned section (list below)

Your scope:
- Pages to audit: {PAGE_LIST}
- Include deep sub-routes of your assigned pages
- Do NOT audit pages outside your section
- Do NOT move, rename, or modify any files

Your task:
1. For each page, read it (shallow — component + data fetches, not every line).
2. Determine: purpose, primary persona, category, zone, placement fit,
   content fulfillment, consolidation candidacy, cognitive load hint.
3. Fill a scorecard row per page using the rubric in the spec (§6).
4. Return a verdict per the verdict vocabulary (§7). Every non-KEEP verdict
   needs a target and a one-sentence rationale.
5. Record gaps (free text, bulleted) for any page scored `thin` or `broken`.
6. If the page belongs in Zone 3 (operator-only), mark it DEMOTE-ADMIN and
   list it in a dedicated handover section at the end of your output.
7. Note any cross-section concerns in a cross-refs section. Do NOT create
   scorecard rows for pages outside your section.

Your output:
- A single markdown file with:
  - A scorecard table (one row per page, all 8 rubric dimensions + verdict
    + target + rationale + gaps)
  - A DEMOTE-ADMIN handover section (may be empty)
  - A cross-refs section (may be empty)
- Do NOT propose a new nav structure. That is Phase 3's job.
- Do NOT modify any files.

Anti-patterns (re-dispatched if violated):
- Multi-tagging categories. Pick one.
- Verdicts without targets. Every non-KEEP verdict needs a target.
- Scope creep. Do not audit neighboring sections out of curiosity.
- Inventing new verdicts. Use the §7 vocabulary only.
- Writing a verdict before writing the purpose sentence.

Hard rule:
- {C1 EQUIVALENT — e.g. "Zone 3 is invisible to customers. Any page that
  looks operator-only gets DEMOTE-ADMIN regardless of its current nav
  placement."}

Return the full scorecard table inline in your reply. Do not write files.
```

---

## 11. Reference Prompts

### 11.1 Top-level dispatch prompt (for handing the playbook to another agent)

Paste this into the target agent on the target platform. It is self-contained.

```
topic: page-cleanup-audit

You are running an information architecture audit on {PRODUCT_NAME}'s
{SURFACE_NAME}. You will follow the playbook at
{PATH_TO_PLAYBOOK_ON_THIS_SYSTEM}.

Your job is to drive Phases 0 through 5. You will dispatch sub-agents for
Phases 1, 2, and 4. You will request human review before Phase 6 and will
NOT start Phase 6 without explicit acceptance.

Before you do anything else:

1. Read the playbook in full.
2. Confirm you have the prerequisites from §1:
   - A disk listing of every page file
   - The current nav tree
   - A short problem statement from the product owner
   - A list of architectural invariants the audit must preserve
   - A planning persistence surface (tracker, spec dir, state file)
3. If any prerequisite is missing, stop and ask the owner.
4. Write the Phase 0 spec using the template in Appendix A of the playbook.
   Fill in your own taxonomy (§3.3), zones (§2, §5.1), personas (§4), and
   constraints (§5.4). Do not copy the Pocket PM examples verbatim — derive
   yours from the problem statement.
5. Present the spec to the owner for review before Phase 1 dispatches.

Hard rules:
- Never move, rename, or delete a page file in Phases 1–5.
- Human review is mandatory between Phase 5 and Phase 6.
- Sub-agents return scorecard tables inline. You concatenate outputs into
  canonical files.
- Re-dispatch any sub-agent that violates an anti-pattern (§9 of the
  playbook).
- If you encounter an architectural invariant that conflicts with a
  verdict, the invariant wins and the verdict needs to be revised.

Your first deliverable is the Phase 0 spec. Dispatch nothing until that
spec is accepted.
```

### 11.2 Sub-agent dispatch prompt

See §10 above — that is the copy-paste template for each Phase 1 / 2 / 4 sub-agent.

### 11.3 Phase 3 / Phase 5 coordinator prompt

```
You are the Phase {3 | 5} coordinator for the IA audit of {PRODUCT_NAME}.

Context files to read:
- {PATH_TO_SPEC}
- {PATH_TO_PHASE_1_OUTPUT}
- {PATH_TO_PHASE_2_OUTPUT}
{PHASE 5 ONLY: - {PATH_TO_PHASE_4_OUTPUT}}

Your task:
1. Read every Phase {1+2 | 1+2+4} scorecard and verdict.
2. Find cross-section conflicts: pages tagged for merge/widgetize whose
   targets disagree or don't exist. Flag each conflict with the specific
   auditor outputs it spans.
3. Resolve category disputes: similar pages tagged with different
   categories. Either pick one (with rationale) or flag as taxonomy
   ambiguity requiring owner input.
4. Draft the proposed nav tree:
   - Phase 3: Zone 1 + Zone 2 only
   - Phase 5: all three zones, plus the per-page action list, new hub
     spec stubs, renames, kills, implementation questions, and risk section
5. Identify DEMOTE-ADMIN handovers (Phase 3) or absorb them (Phase 5).
6. Produce your output file at the canonical location from the playbook
   (Phase 3: `{PATH}/phase3-reconciliation.md`; Phase 5:
   `{PATH}/ia-restructure-proposal.md`).

Do NOT:
- Move, rename, or delete any files.
- Invent new verdicts or categories.
- Silently pick a winner in a taxonomy dispute — flag it for the owner.

Hard rule:
- {C1 EQUIVALENT}

{PHASE 5 ONLY:
Gate: After producing the proposal, STOP. The owner must explicitly
accept the proposal before Phase 6 begins.}
```

---

## Appendix A — Phase 0 Spec Template

Your Phase 0 spec must follow this structure. Section numbering is non-negotiable — it makes later cross-references ("see §6 rubric dimension 3") unambiguous.

```markdown
# {Product} Information Architecture Audit — Spec

**Workstream ID:** {your workstream id}
**Status:** draft (Phase 0 alignment — not yet dispatched)
**Authors:** {owner} + {agent} ({session / date})
**Supersedes:** {none | prior spec ref}
**Blocks:** {what downstream work this unblocks — e.g. "tier scaling exercise"}

---

## 1. Problem statement

{3–8 concrete bullet points naming the symptoms. Specificity matters.}

## 2. Goals

{Numbered list. Each goal is a measurable outcome, not a vibe.}

## 3. Non-goals

{What the audit will NOT do. Lift directly from playbook §0.2 and add your own.}

## 4. Constraints

{C1..CN list. Always include:
 - C1 operator invisibility
 - C_triplet (your architectural invariants)
 - C_planning (your planning persistence protocol)
 - C_phase1-4-no-moves
 - C_orphan-handling}

## 5. The three-zone model (or your N-zone model)

{Name each zone. Describe its intent, visual treatment, permissions, and
traffic pattern. Commit to the operator-invisibility principle.}

## 6. Page taxonomy

{Your 8–15 categories, grouped by zone. Each with a one-sentence scope.
Notes on splits (categories that span zones and had to be split).}

## 7. Primary persona list

{Your persona tags with one-line descriptions.}

## 8. Scoring rubric

{Copy the 8-dimension rubric from playbook §6. Do not modify.}

## 9. Verdict vocabulary

{Copy the 9 verdicts from playbook §7. Do not modify.}

## 10. Phased execution plan

{Phase 0–6. Copy playbook §8 structure. Customize the sub-agent counts
and file paths to match your product.}

## 11. Auditor briefing template

{Copy playbook §10, with {PLACEHOLDERS} filled in for your product.}

## 12. Open questions (deferred to later phases)

{Decisions you will NOT make in Phase 0. Common ones:
 - How is Zone 3 hidden? (Phase 5)
 - For merged hubs, URL-level tabs or query-param tabs? (Phase 5)
 - Does a page kill also kill its API route? (Phase 6)}

---

## Appendix A — Current nav dump

{The full nav tree as of today. Count items. Group by section.}

## Appendix B — Orphan candidates

{Every page file not in Appendix A's nav. Split into:
 - True orphans (no nav parent) — Phase 2 scope
 - Sub-routes of Phase-1 pages (audited alongside parent)}

## Appendix C — Worked scorecard examples

{2–3 concrete scorecards filled in for real pages from your product.
These are calibration for Phase 1 auditors. Pick pages that exemplify
different verdicts (one PATCH, one WIDGETIZE, one DEMOTE-ADMIN, etc.).}

---

## 13. Change log

{Date-stamped entries. Who made what decision, in what session.}
```

---

## Appendix B — Minimum Artifact Set

After a full run of this playbook, you should have these artifacts. If any are missing, the run is incomplete.

| Phase | Artifact | Location |
|---|---|---|
| 0 | Spec | `{spec_dir}/ia-audit-spec.md` |
| 1 | Per-auditor scorecards | `{reviews_dir}/ia-audit/pass-1-<section>.md` (one per section) |
| 1 | Canonical concatenation | `{spec_dir}/ia-audit-phase1-scorecards.md` |
| 2 | Orphan sweep | `{spec_dir}/ia-audit-phase2-orphans.md` |
| 3 | Reconciliation | `{spec_dir}/ia-audit-phase3-reconciliation.md` |
| 4 | Platform audit | `{spec_dir}/ia-audit-phase4-platform.md` |
| 5 | Proposal | `{spec_dir}/ia-audit-proposal.md` |
| 6 | Per-session handoffs | `{handoff_dir}/ia-audit-session-N.md` |

The canonical file path pattern is deliberate: Phase 3 reads from `phase1-scorecards.md`, not from the per-section files — which means the driving agent must concatenate at the end of Phase 1, or Phase 3 will fail.

---

## Appendix C — Common Failure Modes & Recovery

| Failure | Symptom | Recovery |
|---|---|---|
| Taxonomy is wrong | Multiple Phase 1 auditors try to invent new categories | Stop Phase 1. Go back to owner. Revise taxonomy. Re-lock. Re-dispatch. |
| Zone split is wrong | Many `wrong-zone` verdicts | Likely means a category spans zones and needed to be split before Phase 1. Same recovery as taxonomy. |
| Scope creep | A Phase 1 auditor returns scorecards for pages outside its section | Re-dispatch with a stricter scope list in the briefing. Do not merge the out-of-scope rows. |
| Verdict without target | Auditor returns `WIDGETIZE` with no target | Re-dispatch just that verdict for completion. Do not accept it into the reconciliation input. |
| Auditor invents a new verdict | Auditor returns e.g. `SPLIT` | Re-dispatch with a stricter anti-pattern block in the briefing. The verdict they reached for is almost always `WIDGETIZE` one concern + `PATCH` the other. |
| Phase 3 silently picks a winner | Coordinator resolves a taxonomy dispute without flagging it | Re-dispatch Phase 3 with an explicit "you must flag disputes for owner input, not resolve them yourself." |
| Owner rejects Phase 5 proposal | Proposal is shaped wrong even though audit data is sound | Iterate Phase 5 only. Do not re-run Phase 1. |
| Stale orphan list | Phase 2 misses pages that were created after Phase 0 | Re-list from disk at Phase 2 start. This should be the default behavior, not a recovery. |

---

## Appendix D — Scaling Notes

- **<30 pages:** you may not need this playbook. Consider a single-session audit by the owner + one agent, with the rubric but without phases.
- **30–75 pages:** ideal fit. 3–5 Phase 1 auditors, 1 Phase 2 auditor, 1 coordinator. Completable in 1–2 driving sessions.
- **75–150 pages:** full playbook as written. Plan for 3+ driving sessions across Phases 1–5, plus multiple Phase 6 sessions.
- **150+ pages:** consider pre-splitting the audit by product area (e.g. if you have Product A and Product B sharing a nav, run the playbook twice — once per product — with a lightweight cross-product reconciliation layer at the end).
- **Monorepo / multi-surface:** one playbook run per surface. A mobile app + web dashboard share an owner but not a nav, so they don't share an audit.

---

## Change log

- **2026-04-11** — v1. Distilled from Pocket PM IA audit work (source spec: `docs/specs/ia-audit-spec.md`, runbook: `docs/runbooks/ia-audit-ppm-db-mirror.md`). Generalized three-zone model, taxonomy derivation method, 8-dimension rubric, 9-verdict vocabulary, 6-phase execution plan, dispatch templates, and failure-mode recovery matrix.
