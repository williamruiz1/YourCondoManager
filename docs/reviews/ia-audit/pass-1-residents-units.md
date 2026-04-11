# Phase 1 Audit — A2 Residents & Units

**Auditor:** A2
**Date:** 2026-04-11
**Scope:** 2 pages (`units.tsx`, `persons.tsx`)

---

## Scorecard

| Page | Purpose | Persona | Category | Zone | Placement | Fulfillment | Verdict | Target | Rationale | Gaps | Cog |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `units.tsx` `/app/units` | This page exists to manage buildings, unit records, owners, and live occupancy for the active association. | `manager` | Z1-2 Residents & Units | zone-1 | correct | complete | KEEP | — | Top-level nav entry under "Buildings & Units" matches its content exactly; it is the master list for physical inventory and residential relationships within an association. No gaps; CRUD for buildings, units, ownerships, occupancies, CSV import, and inline person creation are all present. | — | high |
| `persons.tsx` `/app/persons` | This page exists to browse, create, and manage all people (owners, tenants, board members) across associations. | `manager` | Z1-2 Residents & Units | zone-1 | wrong-section | complete | RENAME-MOVE | Promote "People" to a peer top-level nav entry alongside "Buildings & Units" within the Z1-2 group, renaming sidebar label from "People" (child of Buildings & Units) to "People" at peer level. | Persons is a cross-cutting master list of all individuals in the system — owners, tenants, and board members — that spans all units and buildings. Nesting it as a child of Buildings & Units implies it is a sub-view of physical inventory, but it is a peer concept (the people directory) that also feeds Governance (board roles) and Finance (ownership/billing linkage). The sidebar parent/child relationship misrepresents the semantic scope. | — | med |

---

## Placement detail — nesting question

The dispatch note for A2 asks explicitly: **is the parent/child nesting of Persons under Buildings & Units correct, or are they peer concepts?**

**Finding: they are peers, not parent/child.**

- `units.tsx` is scoped to physical inventory: buildings → units → ownership/occupancy records within the active association.
- `persons.tsx` is a cross-association people directory: it fetches `/api/persons` without a mandatory association filter, surfaces owners, tenants, and board members in a single list, exposes board-role assignment (a Governance concern), and holds mailing-address and contact data that is consumed by Financial (billing), Governance (board roles), and Communications (announcement recipients).
- Nesting Persons as a child of Buildings & Units in the sidebar suggests Persons is subordinate to physical inventory. A manager looking for the people directory navigates to Buildings & Units to discover it — a discoverability defect.
- The correct sidebar treatment is two sibling entries in the same Z1-2 group: "Buildings & Units" (`/app/units`) and "People" (`/app/persons`) at the same indentation level. This matches the semantic model (physical records + people records = resident roster) without implying hierarchy.

**Placement verdict for `persons.tsx`:** `wrong-section` (wrong nesting level, correct zone and category).

---

## DEMOTE-ADMIN handovers

None. Both pages are Z1-2 (Residents & Units), zone-1 surfaces. Neither has `platform-admin`-only content; both are gated to `["platform-admin", "board-admin", "manager"]` in the sidebar, which is correct for zone-1 manager/admin surfaces.

---

## Cross-refs

1. **`/app/owners` redirect → `/app/persons`** (App.tsx line 249-251): Legacy redirect is in place. No orphan `.tsx` file was found for an `owners.tsx`; the route simply redirects. No C6 action needed — there is no source file to kill.
2. **`/app/occupancy` redirect → `/app/units`** (App.tsx line 252-254): Same pattern — redirect only, no source file. No C6 action needed.
3. **Board role assignment in `persons.tsx`**: The board-role assignment dialog (`/api/board-roles`) is embedded in the People page. This is a Governance concern (Z1-4) surfaced inside a Z1-2 page. It is inline CRUD, not a standalone page, so it does not warrant a separate verdict row — but Phase 3 reconciliation should note that if a dedicated Governance hub is proposed, board-role management may need to appear in both surfaces or be linked from the People row detail.
4. **`amenities.tsx`** (out-of-scope per spec §10 and dispatch instructions): not audited. Noted only because it lives in `client/src/pages/` alongside the in-scope files.
5. **`persons.tsx` page title is "People"** but the route is `/app/persons` and the sidebar child label is also "People". The URL slug `persons` and the display name "People" are slightly inconsistent but not a defect requiring a verdict — noted for Phase 5 URL-contract review (spec §12 Q7).
