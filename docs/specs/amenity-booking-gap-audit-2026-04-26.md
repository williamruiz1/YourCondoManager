# Amenity Booking — Gap Audit (2026-04-26)

**PPM:** `498e3e3b-d57e-4bda-8638-4a1673c50161` ("Re-implement Amenity Booking — post-overhaul")
**Question:** Should we re-implement Amenity Booking against post-overhaul trunk, or is the live implementation sufficient?
**Audit author:** background research agent
**Base commit:** `9dd057e` (origin/main)

---

## TL;DR

Amenity Booking is **already implemented end-to-end on `main`** — schema, admin CRUD, owner-side browse + reserve + cancel, conflict detection, blackout-date holds, per-association feature toggle, and E2E coverage. The PPM workitem is stale: the "abandoned `integration/three-features-baseline` branch" it references appears to have been superseded by the `4cbe2be` "Published your App" Replit checkpoint (2026-04-11) that landed the full feature directly to main, and was subsequently reinforced by PR #21 (3a per-association toggle), PR #40 (3.5 PortalShell restructure), and PR #44 (E2E smoke).

**Recommendation: A — Close the PPM as already-done.** A small follow-up wave (Option B) is also viable if the founder wants to address the documented naming/UX nits or add the missing admin-test coverage; concrete items are listed below.

---

## What exists on main today

### Server endpoints (`server/routes/amenities.ts`, 406 LoC)

Admin (gated by `requireAdmin` + role list):

| Method | Path | Roles |
|---|---|---|
| GET | `/api/amenities?associationId=…` | platform-admin, board-officer, assisted-board, pm-assistant, manager, viewer |
| POST | `/api/amenities` | platform-admin, board-officer, assisted-board, pm-assistant, manager |
| PATCH | `/api/amenities/:id` | (same as POST) |
| DELETE | `/api/amenities/:id` | (same as POST) — soft-delete via `isActive=0` |
| GET | `/api/amenities/:id/reservations` | (read role list) |
| PATCH | `/api/amenity-reservations/:id` | (write role list) — approve/reject/cancel + set `approvedAt` |
| GET | `/api/amenities/:id/blocks` | (read role list) |
| POST | `/api/amenities/:id/blocks` | (write role list) |
| DELETE | `/api/amenity-blocks/:id` | (write role list) — hard delete |

Portal (gated by `requirePortal` + per-association `amenitiesEnabled` runtime gate, structured 404 `AMENITIES_FEATURE_DISABLED`):

| Method | Path | Notes |
|---|---|---|
| GET | `/api/portal/amenities/settings` | returns `{ amenitiesEnabled }` (no toggle gate; used to drive the "feature off" 404) |
| GET | `/api/portal/amenities` | active amenities only |
| GET | `/api/portal/amenities/my-reservations` | future reservations only (`endAt >= now`) |
| GET | `/api/portal/amenities/:id/availability?from=&to=` | merges reservations + blocks into `busyWindows` |
| POST | `/api/portal/amenities/:id/reservations` | enforces past-block, min/max duration, booking window, **conflict detection vs reservations and blocks** (409), and approval-required vs auto-approve |
| DELETE | `/api/portal/amenity-reservations/:id` | sets `status="cancelled"`, owner-scoped via `personId` |

Server-side admin-toggle endpoints (referenced by `docs/api-reference-2026-04-25.md`, owned outside this file):

- GET `/api/associations/:id/settings/amenities`
- PATCH `/api/associations/:id/settings/amenities`

Auth predicate for those lives at `shared/amenities-toggle-auth.ts` (Manager + platform-admin always; Board Officer only for self-managed; everyone else denied — covered by `tests/amenities-toggle-auth.test.ts`).

### Client surfaces

- `client/src/pages/amenities-admin.tsx` (450 LoC) — admin page at `/app/amenities`, three tabs:
  1. **Amenities** — full CRUD form (name, category, description, capacity, booking-window-days, min/max duration minutes, requires-approval, isActive). Categories: general / pool / gym / community-room / bbq / tennis-court / clubhouse / other.
  2. **Reservations** — per-amenity, date-range filtered, with Approve / Reject / Cancel actions on rows.
  3. **Blackout Dates** — per-amenity create + delete blocks (admin-side maintenance/private-event holds).
- `client/src/pages/portal/portal-amenities.tsx` (436 LoC) — owner page at `/portal/amenities` under PortalShell:
  - Settings prefetch — renders `<NotFound/>` if `amenitiesEnabled === false`.
  - **Amenities** tab — list of `AmenityCard`s with description + capacity + duration window + booking-window. Each card has "View availability" (week grid showing busy slots from reservations + blocks) and "Book now" (datetime-local pick + optional notes; submit shows "Reservation submitted, pending approval" or "Reservation confirmed" depending on `requiresApproval`).
  - **My reservations** tab — future reservations only, with cancel button on pending/approved.
- `client/src/components/settings/amenities-feature-toggle-card.tsx` — Manager/Board Officer-facing toggle UI in association settings.

### Schema (`shared/schema.ts` lines 2982–3035)

- `amenities` — id, associationId, name, description, category (default `general`), capacity, **bookingWindowDays** (default 30), **minDurationMinutes** (default 30), **maxDurationMinutes** (default 240), **requiresApproval** (0/1), isActive (0/1), createdAt, updatedAt.
- `amenityReservations` — id, amenityId, associationId, personId, startAt, endAt, **status** enum `pending|approved|rejected|cancelled` (default `pending`), notes, approvedBy, approvedAt, createdAt, updatedAt.
- `amenityBlocks` — id, amenityId, associationId, startAt, endAt, reason, createdBy, createdAt.
- Forward-only migrations: `migrations/0001_amenity_booking.sql` (initial three tables + FKs) and `migrations/0008_amenities_enabled.sql` (per-association toggle).

### Test coverage

- `tests/amenities-toggle-auth.test.ts` — Vitest unit, `checkAmenitiesToggleAuth` matrix for the toggle endpoints.
- `tests/amenities-toggle-route.client.test.tsx` — client-route-gating coverage when `amenitiesEnabled = 0`.
- `tests/amenities-toggle-sidebar.client.test.tsx` — client sidebar conditional render.
- `tests/e2e/playwright/amenities-toggle-roundtrip.spec.ts` — real-backend E2E for the toggle round-trip.
- E2E smoke for the broader portal nav including amenities lives in `tests/e2e/playwright/owner-portal-navigation.spec.ts` (Wave 15b/16c).

**Coverage gaps:**
- No dedicated unit/integration suite for the **booking conflict detection** (`POST /api/portal/amenities/:id/reservations` — overlap vs reservation, overlap vs block, min/max duration enforcement, booking-window enforcement, past-block).
- No dedicated suite for the **admin reservation transitions** (`PATCH /api/amenity-reservations/:id`: pending → approved / pending → rejected / approved → cancelled, including the `approvedAt` write).
- No suite for **blackout-date CRUD** (POST + DELETE on `/api/amenities/:id/blocks`).
- No coverage for the **owner-side cancel** auth scope (the route filters by `personId`, but no test asserts a different person cannot cancel someone else's reservation).

---

## What the original abandoned branch had

**Could not be recovered.** The branch `integration/three-features-baseline` is not in `git branch -a`, not on origin, and not in the reflog. No commit on any ref mentions "three-features-baseline" or "three-feature". `gh pr list --state all --search "amenity"` returns only the PRs that landed on main (#10, #15, #21, #27, #40, #44, #47, #51, #55, #56, #77, #81, #82) — no closed-without-merging amenity PR exists.

Surviving signals about original intent:

1. **The `4cbe2be` Replit "Published your App" checkpoint (2026-04-11)** introduced the entire amenity-booking system in a single 446-line `amenities-admin.tsx` plus a 351-line `amenities.tsx` (resident, later folded into `portal/portal-amenities.tsx` by PR #40), plus `server/routes/amenities.ts` and the `0001_amenity_booking.sql` migration. This is almost certainly the work the PPM workitem is referring to as "needing re-implementation" — but it was already on `main`, never on a side branch.
2. **`docs/projects/platform-overhaul/decisions/4.2-owner-portal-gaps.md`** — Gap 5 ("Amenity booking inline") was scoped as PENDING, with two questions resolved on 2026-04-24 (Session B):
   - **4.2 Q3:** session-gate-only status quo + 3a per-association toggle addendum. Inline integration into `/portal/community` was **explicitly declined**; `/portal/amenities` stays as its own route.
   - **3.5 Q5:** PRE-RESOLVED by 4.2 Q3 — `portal-amenities.tsx` is its own zone file under PortalShell.
3. **`docs/reviews/ia-audit/pass-1-community-amenities.md`** — flags a naming/URL nit (`Amenity Booking` sidebar label is misleading because the page is operator config, not a booking calendar) and recommends a Phase-5/6 RENAME-MOVE: sidebar `Amenity Booking` → `Amenity Admin`, URL `/app/amenities` → `/app/amenity-admin`, `<h1>` to `Amenity Management`. Cosmetic; not a feature gap.

There is no surviving spec describing functionality the PPM workitem expected that is not already on main.

---

## Gap analysis

| Item | Status on main | Category |
|---|---|---|
| Amenity CRUD (admin) | **exists** | — |
| Per-association feature toggle | **exists** (3a, PR #21) | — |
| Categories taxonomy | **exists** (8 categories) | — |
| Capacity field | **exists** | — |
| Booking-window-days | **exists** | — |
| Min/max-duration-minutes | **exists** | — |
| Requires-approval flag (per amenity) | **exists** | — |
| Owner browse list (active only) | **exists** | — |
| Owner availability (week-grid) | **exists** | — |
| Owner book (instant + approval-required) | **exists** | — |
| Owner my-reservations (future only) | **exists** | — |
| Owner cancel | **exists** | — |
| Admin approve / reject reservations | **exists** | — |
| Admin reservation date-range filter | **exists** | — |
| Admin blackout dates (CRUD) | **exists** | — |
| **Reservation conflict detection** (vs other reservations) | **exists** (409, both pending+approved) | — |
| **Reservation conflict detection** (vs blocks) | **exists** (409) | — |
| Past-block on owner booking | **exists** | — |
| Min/max duration enforcement on owner booking | **exists** | — |
| Booking-window enforcement | **exists** | — |
| Owner cancel scoped to own reservation (`personId` filter) | **exists**; not asserted by a test | — |
| Soft-delete on amenity (isActive=0) | **exists** | — |
| Schema multi-tenant scoping (`associationId` FK) | **exists** | — |
| Sidebar/route 404 when feature off | **exists** (3a) | — |
| E2E smoke for toggle round-trip | **exists** (Playwright) | — |
| Booking conflict-detection unit/integration tests | **missing** | gap |
| Admin reservation transition tests (approve / reject / cancel + `approvedAt`) | **missing** | gap |
| Blackout CRUD tests | **missing** | gap |
| Owner-cancel cross-tenant negative test | **missing** | gap |
| Sidebar/URL/H1 naming fix (`Amenity Booking` → `Amenity Admin`) | **deferred** by IA audit; no impl | gap (cosmetic) |
| Inline integration into `/portal/community` | **explicitly declined** by 4.2 Q3 lock | (out of scope by lock) |
| Email/notification on reservation status change | **missing** | speculative |
| Per-amenity rules — no double-booking by same person, day caps, hour-of-day windows, weekend blackouts, cooldowns | **missing** | speculative |
| Calendar export (.ics) | **missing** | speculative |
| Guest-policy fields, fee-per-reservation, deposit, waiver-required | **missing** | speculative |
| Capacity-aware concurrent reservations (currently 1 reservation per slot regardless of `capacity`) | **partially missing** — `capacity` is captured but **not enforced** at conflict time | gap (latent bug, see note) |
| Recurring reservations (weekly slot for a fitness class, etc.) | **missing** | speculative |
| Amenity-image / cover-photo | **missing** | speculative |
| Pool-fob / package-room / parking-pass-style "access" amenities (no time-slot, just gating) | **missing** | speculative |

### Notes / latent bugs surfaced during audit (not fixed — research-only)

1. **Capacity field is captured but not enforced.** `amenities.capacity` is collected in admin UI and stored, but `POST /api/portal/amenities/:id/reservations` rejects on **any** time overlap, not on `capacity`-many overlaps. Either capacity should be enforced (so a 4-person community room could be reserved by 4 households at once) or the field should be relabeled as informational ("Up to X people" displayed to owners). Today the owner card says "Up to {capacity}" which implies multi-party booking, but the conflict logic forbids it. **Real bug or weak product framing — founder call.**
2. **Owner cancel race condition / no test.** `DELETE /api/portal/amenity-reservations/:id` filters by `personId`, which is correct, but there is no negative test for "owner B cannot cancel owner A's reservation". Worth a single `it()` block.
3. **`approvedBy` is never written.** The PATCH admin handler sets `approvedAt` on `status="approved"`, but does not write `approvedBy` (the schema column exists). Audit-trail gap.
4. **Block delete is hard delete, amenity delete is soft.** Mild inconsistency. Probably fine — blocks are admin scratch space; amenities have history that needs preserving — but worth noting if a future report ever needs deleted blocks.

---

## Recommendation

**Option A — Close the PPM workitem as already-done.**

Rationale:

1. The PPM workitem premise — "abandoned branch needs re-implementation against post-overhaul trunk" — is incorrect. The original work landed directly on `main` via the `4cbe2be` Replit checkpoint on 2026-04-11, well before any "post-overhaul" trunk existed. There is no abandoned work to recover.
2. Every Layer-1/2/3 lock that touched amenities (2.2 Q6 session gate, 3.5 Q4/Q5, 4.2 Q3 + 3a addendum) has shipped. The post-rename + post-restructure trunk already reflects them.
3. The locked spec is **`/portal/amenities` as its own route under PortalShell, gated by per-association toggle, no inline `/portal/community` integration**. That is exactly what is on main today.
4. There is no surviving spec describing functionality the PPM workitem expected that is missing from main.

If the founder disagrees and wants closure work, the smallest valid follow-up is **Option B** below — but it is not a re-implementation, it is a polish wave.

### Option B — Targeted follow-up wave (alternative if A is rejected)

If the founder wants to keep the PPM open, the concrete in-scope items are:

| # | Item | Rough LoC | Risk |
|---|---|---|---|
| 1 | Decide capacity semantics (enforce vs. relabel) and either wire conflict logic to honor `capacity` OR change the owner card copy. | ~30 LoC server + ~5 LoC client OR 5 LoC client only | low |
| 2 | Write `approvedBy` on `PATCH /api/amenity-reservations/:id` when status flips to `approved`. | ~3 LoC | trivial |
| 3 | Add Vitest integration suite for booking conflict detection + duration/window enforcement. | ~150 LoC test | low |
| 4 | Add Vitest integration suite for admin reservation transitions (approve/reject/cancel + `approvedBy`/`approvedAt`). | ~80 LoC test | low |
| 5 | Add Vitest integration suite for blackout CRUD + the cross-tenant cancel negative case. | ~80 LoC test | low |
| 6 | Optional: implement the IA-audit RENAME-MOVE (`Amenity Booking` → `Amenity Admin`, URL slug, `<h1>`, `RouteRedirect`). | ~25 LoC | low |

Total estimated LoC: ~370 (mostly tests). Single PR is feasible. No schema change required for items 1–5 (item 1 is a logic-or-copy decision, not a schema migration).

### Option C — Fresh spec session

Not warranted. The original spec is recoverable from the docs already in `docs/projects/platform-overhaul/decisions/` (4.2 Q3, 3.5 Q4/Q5, the IA audit), and the implementation matches them.

---

## Decision needed from founder

1. Confirm A (close PPM) or B (run the polish wave above).
2. If B: pick item 1's resolution (enforce `capacity` vs. relabel as informational).
3. If B: confirm whether the IA-audit RENAME-MOVE is in or out of scope for this wave (originally Phase 5/6 work).
