# Phase 1 Audit — A1 Overview & Context

**Auditor:** A1
**Date:** 2026-04-11
**Scope:** 5 pages — `dashboard.tsx`, `portfolio.tsx`, `associations.tsx`, `association-context.tsx`, `new-association.tsx`

---

## Scorecard

| Page | Purpose | Persona | Category | Zone | Placement | Fulfillment | Verdict | Target | Rationale | Gaps | Cog |
|------|---------|---------|----------|------|-----------|-------------|---------|--------|-----------|------|-----|
| `dashboard.tsx` (`/app`) | This page exists to surface portfolio-wide and association-scoped health stats, live alerts, quick actions, and active elections in one place. | `manager` | Z1-1 Command Center | zone-1 | correct | complete | PATCH | Keep in Overview group; rename header label to "Command Center" or "Home" to reduce ambiguity vs. Portfolio | Dashboard conflates portfolio-level counts with per-association alert triage, which overlaps with Portfolio's KPI summary — the distinction needs a label clarification, not a structural move. | — Stat cards (Associations, Units, Owners, Tenants, Board Members, Documents) are portfolio-level and duplicate the totals visible in Portfolio; consider whether these belong here or on Portfolio exclusively. — Quick Actions panel links to a legacy redirect (`/app/financial/ledger` → `/app/financial/billing`) which is stale. | high |
| `portfolio.tsx` (`/app/portfolio`) | This page exists to compare health KPIs, risk alerts, financial summary, and recent activity across all associations in the managed portfolio. | `manager` | Z1-1 Command Center | zone-1 | wrong-section | complete | RENAME-MOVE | Promote to primary Command Center or clearly differentiate as "Portfolio Health" beneath Dashboard | Portfolio is the more powerful cross-association view but is subordinate in nav to a Dashboard that partly duplicates its scope; the two pages claim the same Z1-1 niche without a clear ownership boundary. | — Dashboard's stat cards (total associations, units, owners) overlap with Portfolio's `AssociationKPI` table. — No explicit label differentiating "per-association drill-down health" (Portfolio) from "today's action list" (Dashboard). | high |
| `associations.tsx` (`/app/associations`) | This page exists to list, create, edit, archive, and switch the active association within the operator workspace. | `manager` | Z2-1 Association Setup | zone-2 | wrong-section | complete | RENAME-MOVE | Move from Overview nav group to a Setup/Configuration section or footer group | Associations is a setup-and-switch surface visited during onboarding and when changing context, not a daily-return operational page; placing it in the same nav group as Dashboard implies equal daily weight. | — The create-association flow (dialog) lives here AND in `new-association.tsx`, creating two parallel entry points for the same action; one should be canonical. | med |
| `association-context.tsx` (`/app/association-context`) | This page exists to display and manage the active association's profile, onboarding progress, unit directory, resident invites, and activity feed. | `manager` | Z2-1 Association Setup | zone-2 | wrong-section | complete | RENAME-MOVE | Rename to "Association Workspace" or "Setup & Context"; surface as a tab of `associations.tsx` or a sidebar sub-item under the active association header | This page serves as a per-association detail/setup view (onboarding state, profile edit, invite management) but is unreachable from the sidebar nav — it is only reachable via shortcuts in Dashboard header or after creating a new association, making it a hidden setup hub. | — Not in the sidebar at all; only accessible via Dashboard header shortcut or post-creation redirect. — Tabs (overview / onboarding / records) cover distinct concerns that may warrant individual routes as the page grows. — The "records" tab renders documents filtered by association, duplicating scope with `documents.tsx`. | high |
| `new-association.tsx` (`/app/new-association`) | This page exists to register a new association via a two-step wizard (details + location). | `manager` | Z2-1 Association Setup | zone-2 | wrong-section | thin | WIDGETIZE | Absorb into `associations.tsx` as a dialog/sheet, or merge into `association-context.tsx` post-create flow | `new-association.tsx` is a standalone page (listed as "New Association button" in footer, platform-admin only) but `associations.tsx` already contains a create dialog backed by the same `POST /api/associations` mutation — having two separate create flows for the same action adds nav weight and confusion. | — Duplicate create path: `associations.tsx` has an inline dialog using the same form schema and `POST /api/associations`; one of the two flows will be missed by users. — No edit-in-place for the second step (location) after initial submit — user must re-enter. — Footer placement is platform-admin-only by sidebar note, but the route itself is not role-gated in `App.tsx:246`. | med |

---

## Command Center overlap analysis (re: §1 symptom 5)

All three command-center candidates visible to A1:

- **`dashboard.tsx`** is scoped to whichever association is active (or portfolio-wide if none), shows counts, alerts, elections, quick actions, and a setup wizard. It is action-oriented.
- **`portfolio.tsx`** is always cross-association; shows KPI table per association, risk alerts, threshold alerts, financial summary, and recent activity feed. It is analytical/comparative.
- **`operations-dashboard.tsx`** — out of A1 scope; referred to A6.

**Finding:** Dashboard and Portfolio occupy the same Z1-1 niche. Dashboard is the landing page (`/app`) and the more action-oriented of the two; Portfolio is the more analytical multi-association health view. The current nav places them as peers under "Overview," which leaves neither as a clearly designated primary command center. Phase 3 should decide: either (a) merge Portfolio's KPI table into Dashboard as a collapsible section and retire the separate Portfolio page, or (b) make Portfolio the primary landing page and refocus Dashboard as a per-association "today" view after context selection.

Cross-ref to A6: `operations-dashboard.tsx` is a third command-center candidate. A6 should determine whether it overlaps with either of the above and, if so, which zone and category it belongs to.

---

## DEMOTE-ADMIN handovers

None. All five pages in this section serve `manager`, `board-admin`, or `viewer` personas. No page in this scope is platform-operator-only.

Note: `new-association.tsx` is listed in the sidebar as "platform-admin only" (Appendix A, footer note), but the route `App.tsx:246` applies no role gate — any authenticated user can navigate directly to `/app/new-association`. This is a known-gap flag (C3), not a DEMOTE-ADMIN verdict, because the semantic persona is `manager`, not `platform-admin`.

---

## Cross-refs

1. **`operations-dashboard.tsx` (A6 scope)** — Per §1 symptom 5 and the command-center overlap analysis above, A6 should explicitly determine whether `operations-dashboard.tsx` is a third Z1-1 Command Center or a Z1-6 Service & Maintenance landing page, and cross-reference its KPI content against `dashboard.tsx` and `portfolio.tsx`.

2. **`/app/financial/ledger` quick-action link in `dashboard.tsx`** — The QuickActions panel in `dashboard.tsx` links to `/app/financial/ledger`, which is a `<RouteRedirect>` to `/app/financial/billing` (App.tsx:272). The link still works but the label "Post Ledger Entry" references a legacy path. A3 (Finance) should note this stale label when auditing `financial-billing.tsx`.

3. **`isSingleAssociationBoardExperience()` redirect logic** — At `App.tsx:243` and `App.tsx:301`, both `/app/associations` and `/app/portfolio` redirect to `/app` for board-admins with ≤1 association. This means those two pages effectively collapse into Dashboard for a large user segment. Phase 3 should evaluate whether this silent redirect is the intended UX or whether a dedicated single-association entry point is needed.

4. **`association-context.tsx` "records" tab** — The records tab queries `GET /api/documents?associationId=...` and renders association-scoped documents. This duplicates the concern of `documents.tsx`. A5 (Documents & Insurance) should cross-reference.

5. **`owner-portal.tsx` in Platform Controls sidebar** — Out of A1 scope but noted per §1 symptom 3: `/portal` is linked from the Platform Controls nav group. This is an `/app/*`-external surface embedded in an operator menu. Phase 3 / Phase 4 should resolve placement.
