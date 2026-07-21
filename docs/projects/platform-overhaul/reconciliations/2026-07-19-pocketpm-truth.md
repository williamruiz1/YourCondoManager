# PocketPM Truth Reconciliation — 2026-07-19

## Purpose

Record the evidence used to reconcile YCM's PocketPM lifecycle with merged GitHub history and the canonical Platform Overhaul index.

This is an audit record, not a replacement feature map. Live PocketPM remains the product-management source of truth; GitHub `main` and merged pull requests are the implementation evidence.

## Verified baseline

- GitHub `main` at the original reconciliation: `137a3c5` (`Fix fail-closed tenant isolation and IDORs`, PR #460).
- Phase 11 Sidebar + Routes: merged via PR #89 / `fac69a5`.
- Phase 12 Financials role-gating: merged via PR #93 / `34cb782`.
- Current Platform Overhaul frontier: **Phase 13 Operations**.
- Phase 14 Governance, Phase 15 Communications, and Phase 16 Platform remain.

## PocketPM lifecycle corrections applied

Agents stop at `review`; PM approval remains required.

| PocketPM task | Previous state | Evidence | Reconciled state |
|---|---|---|---|
| `33473b67-8d69-4a67-b18f-5acefca70e96` — Wave 40 board-admin enum cleanup | `in_progress` | PR #72 / `a37b1f5` | `review` |
| `9ed0a9c9-b974-4eff-b0c7-6f028bdc1ee4` — Wave 39 trial + second-HOA upgrade | `in_progress` | PR #71 / `863384d` | `review` |
| `a4cbea7c-7c2c-4e57-b9b4-439b39901ecf` — Wave 32 alert push/email | `in_progress` | PR #63 / `d3d8299` | `review` |
| `5fa11c46-1e93-4991-a4c3-a8c8f3d63558` — Platform Overhaul 0.2 Persona Map | `in_progress` | `88981ba`; consumed by later shipped modules | `review` |
| `ac0734d2-88e3-412c-97b7-3e497fd936e1` — Platform Overhaul 1.3 breadcrumbs | `assigned` | PR #11 / `feea98f` | `review` |
| `5e46e116-f528-4aa5-8d59-779328a546ce` — late-fee billing bug | `queued` | PR #235 / `311cb2e`; superseded by idempotent orchestrated billing | `review` |

PocketPM planning record: `3758af71-2dc1-4d43-9d84-9d627571db74`.

## Deliberately still active

`7b23d9c6-b087-4063-9c70-ec3e731c7963` — Platform Overhaul 3.3 remains `in_progress`.

Only Financials/Phase 12 is complete. The task must remain active until Operations, Governance, Communications, and Platform land with their parity and rollout gates.

## Existing PM review queue

Thirty-eight cards already had the correct `review` lifecycle state and have merge or supersession evidence. They were not advanced beyond `review`, because approval and completion are PM-only actions.

The queue covers:

- Platform Overhaul 0.1, 1.1, 1.2, 1.4, Layer 2, 3.1, and 3.2.
- Waves 16, 16b, 16c, 16d, 23–31, 34, 36, 39 follow-up, and 41–45.
- Dark-mode policy, signup, push notifications, autopay, financial reports, delinquency, and Community Hub.

Superseded or duplicate cards should be approved or rejected with the successor evidence preserved, rather than silently deleted.

## GitHub backlog reconciliation

### Stale pull requests to retire after preserving any unique residue

- #481 — superseded by merged #490.
- #465 — superseded by merged #457.
- #407 — superseded by merged #417.
- #395 — upload-artifact v7 is already on `main`.
- #483 — duplicate of the route-inventory snapshot bundled into #478.
- #374 — older duplicate of dependency candidate #255.
- #401 — core queue/permission ladder superseded by merged #400; extract only unique owner-FAQ work first.
- #461 — most contents superseded; preserve only the unique hosted-runner fallback as a clean follow-up.

### Active pull requests at the original reconciliation

- #528 — integer-cents ledger migration; rebase, rerun migration guard, and preserve founder ratification.
- #505 — protected CHC balance reconciliation; keep parked until founder review.
- #484 — Stripe client consolidation; rebase and retest.
- #478 + #479 — genuine stacked monolith decomposition; repair the base first.
- #476 — narrow type-safety fix; rebase and retest.
- #423 — billing lifecycle emails; rebase and retest.
- #493 — memorystore update; low-priority rebase and retest.
- #255 — major dependency compatibility project, not a routine dependency merge.

### Resolved or duplicate issues to close with evidence

- #363 + #379 — fixed by merged #413.
- #468 + #473 — fixed by merged #474.
- #521–#525 — fulfilled by merged #536; file one narrow residual follow-up only if needed.
- #101 — superseded by pricing v3 and later pricing work.
- #329 — code gap fixed by merged #430; track production activation separately.
- #224 — superseded by current database-retirement issue #539.

## Documentation corrections in this reconciliation

- Updated `00-index.md` to record Phase 11 complete, Phase 12 complete, and Phase 13 next.
- Marked the Owner Portal restructure and Storybook module as shipped.
- Corrected signup/checkout shipped scope and accepted RouteGuard ADR status.
- Updated the 3.3 handoff so executors resume at Operations instead of restarting Financials.
- Marked the dated architecture document as a historical snapshot.

## Generated-context warning

`.pocketpm/CONTEXT.md` is a generated cache and was not edited.

The JSON files under `docs/agent-bootstrap/` predate the current route and roadmap state. A required `npm run bootstrap:agent` refresh was attempted on 2026-07-19, but the database-backed generator could not run because no `DATABASE_URL` was available. The generator still reads the legacy Admin Roadmap tables rather than PocketPM, so the generated JSON was left untouched instead of being presented as current. `docs/agent-bootstrap/README.md` now identifies live PocketPM and this initiative index as the current authorities.

## 2026-07-21 live reconciliation addendum

This record was recovered from a stranded local commit and reconciled against production before publication. Current `main` is `4c63814`.

- The faithful Owner Portal rebuild is no longer active work: PR #535 merged as `6ea524d` and the later payment/finance continuity repairs landed in PRs #536 and #546–#560.
- The public Cherry Hill Community Hub redesign and authenticity pass are live through PRs #544, #545, #561, and `/community/cherryhill` plus all five public hub resolver paths return HTTP 200 in production.
- Board, Property Manager, Assisted Board, multi-association Board Officer, and Owner workflow continuity repairs landed through PRs #548–#550 and #553–#554. Their PocketPM cards remain in `review`; PM approval is still required.
- William-only contextual feedback truthfulness and route-redaction repairs are live through PR #562. GitHub issue delivery is still credential-gated; the durable database fallback is live and now reports that state truthfully.
- PR #505 (protected CHC balances) remains open, review-required, and conflicting. It must stay parked for William's protected-data review.
- PR #528 (integer-cents ledger migration) remains open, review-required, and conflicting. It must stay parked until William chooses the brief maintenance window or the two-deploy expand/contract rollout.

This addendum does not auto-approve PocketPM review cards. It records implementation and deployment truth while preserving founder and PM gates.
