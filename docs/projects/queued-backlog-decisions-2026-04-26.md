# Queued PPM Backlog — Founder Decision Log

**Date:** 2026-04-26
**Total queued items at start:** 17
**Format:** for each item — context, decision needed, options, recommendation, decision recorded

---

## Decisions

### Batch 1 — critical/high overhaul foundation (DECIDED)

| # | Item | PPM | Decision | Plan |
|---|---|---|---|---|
| 1 | Layer-2 Primitives Bundle Phase 8c | `a84162c2` | **A** — ship 8c now (retire `BoardPortal` shunt + collapse client portal-role types) | Pure deletion, ~400 LoC, unblocks 3.3 |
| 2 | 3.1 Sidebar redesign | `bb5baae3` | **C** — defer until 3.2 lands first | Avoid rewiring sidebar URLs twice |
| 3 | 3.2 Route restructure | `b38ac77c` | **A** — one Phase 11 PR per spec | Spec mandates atomicity; ~600 LoC, mostly additive |
| 4 | 3.3 Role-gating zones | `7b23d9c6` | **B** — Zone 1 (Financials) as proof-of-concept, then evaluate | Stop-the-line discipline requires serial |
| 5 | 2.4 Platform-admin audit | `043c1502` | **A** — schedule as Phase 16 (last zone), after 3.3 zones 1–4 | Per spec sequencing; avoids merge conflicts |

**Sequencing produced:** 8c (Phase 8c) → 3.2 (Phase 11) → 3.1 (sidebar) → 3.3 zone 1 (Financials) → eval → zones 2–4 → 2.4 (Phase 16).

---

### Batch 2 — feature backlog + retirement (DECIDED)

| # | Item | PPM | Decision | Plan |
|---|---|---|---|---|
| 6 | Retire `hoaFeeSchedules` | `bc8aa43f` | **B** — pause until prod schema synced + row-count audited | Don't run a destructive migration with prod migration drift unresolved |
| 7 | 3.5 Owner Portal BUILD | `ca6972a3` | **A** — mark stale; Wave 11 already shipped 8 zone files | Visible in `client/src/pages/portal/` |
| 8 | 3.4 Breadcrumb implementation | `c23a5d54` | **B** — bundle into 3.3 zone PRs (Phases 12–15) | Matches spec; one PR per zone instead of standalone sweep |
| 9 | Re-implement Amenity Booking | `498e3e3b` | **A** — investigate stale-ness first (gap audit vs abandoned branch) | Server endpoints exist; need to confirm scope match before dispatching |
| 10 | Re-implement Bulk Communications | `ab193305` | **B** — author spec first (founder session), then dispatch | No spec → agent guesses → wrong 1500 LoC |

---

### Batch 3 — Phase 1B/2B/3B + governance + stale (DECIDED)

| # | Item | PPM | Decision | Plan |
|---|---|---|---|---|
| 11 | Phase 1B Payment UX polish | `14abc92f` | **B** — author spec first | Receipt format / triggers / fields are founder calls |
| 12 | Phase 2B Autopay robustness | `5304044f` | **B** — author spec first | Failure-handling policy (retries, notification cadence) is founder call |
| 13 | Phase 3B Collections polish | `73ce3d18` | **B** — author spec first | Late-fee rules are jurisdictional (CT-specific); legal/founder ratification needed |
| 14 | Wave 29 prefers-reduced-motion | `d756b0b7` | **A** — mark stale; PR #62 already shipped | Confirmed merged 2026-04-25 |
| 15 | 0.3 Navigation Model governance | `921e7b61` | **B** — keep open until 3.3 zone 5 lands | Final receipt that the model was internalized in actual implementation |

---

### Batch 4 — low-priority remainder (DECIDED)

| # | Item | PPM | Decision | Plan |
|---|---|---|---|---|
| 16 | Re-implement Package & Parcel Tracking | `79c92a0e` | **C** — defer indefinitely | Speculative; no customer demand; re-evaluate if asked |
| 17 | Future — Legal & reconciliation | `26a58841` | **A** — keep as `Future` placeholder | Visible signal of direction; too early to invest in a Northstar |

---

## Rollup — what gets dispatched, what waits, what's stale

### Ready to dispatch (agent-actionable, no founder-time)

| # | Item | Effort | Sequencing |
|---|---|---|---|
| 1 | Layer-2 Phase 8c (`BoardPortal` retirement + client portal-role collapse) | ~400 LoC | **First** — unblocks 3.3 |
| 3 | 3.2 Route restructure (Phase 11 PR) | ~600 LoC | After 8c |
| 2 | 3.1 Sidebar redesign | ~1000 LoC | After 3.2 |
| 4 | 3.3 Zone 1 — Financials (`<RouteGuard>` wrap + breadcrumbs per #8) | ~500 LoC | After 3.1; eval before zones 2–4 |
| 5 | 2.4 Platform Admin (Phase 16) | ~600 LoC | After 3.3 zones 1–4 land |

### Waits on you (founder spec session)

| # | Item | Required input |
|---|---|---|
| 9 | Re-implement Amenity Booking | Quick gap audit: what does main lack vs original spec? |
| 10 | Bulk Communications | Spec: campaign UX, recipient selection, send model |
| 11 | Phase 1B Payment UX polish | Spec: receipt format, fields, trigger events |
| 12 | Phase 2B Autopay robustness | Policy: retry count, failure-notification cadence |
| 13 | Phase 3B Collections polish | Legal review: CT-specific late-fee rules |
| 6 | Retire `hoaFeeSchedules` | Run prod `db:push` first; audit row count |

### Stale — close in PPM

| # | Item | Why |
|---|---|---|
| 7 | 3.5 Owner Portal BUILD | Wave 11 shipped 8 zone files |
| 14 | Wave 29 prefers-reduced-motion | PR #62 merged 2026-04-25 |

### Keep open as governance/placeholder

| # | Item | Reason |
|---|---|---|
| 15 | 0.3 Navigation Model governance | Close after 3.3 zone 5 lands |
| 16 | Package & Parcel Tracking | Deferred — re-evaluate on demand |
| 17 | Legal & reconciliation foundations | `Future` placeholder, no work |

---

## Suggested next move

If autonomous track resumes, the agent-actionable sequence above is unambiguous: **Phase 8c first** (smallest, pure deletion, unblocks the chain). Spec sessions for items 9–13 can run in any order — pick whichever blocker matters most to you next.

