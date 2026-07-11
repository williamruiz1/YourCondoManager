# YourCondoManager — Product + Production-Readiness + Opportunity Audit

**Date:** 2026-07-03
**Auditor:** Fable 5 readiness auditor (cruise-prep pipeline: audit → PocketPM backlog → eligible fleet dispatches)
**Methodology:** `founder-os/wiki/research/audit-methodology-refined-2026-07-03.md` — three co-equal axes (Gaps · Opportunities · Risk), decision-surface-first output, live-verified claims. Prior readiness pass (issues #204–#225, 2026-05-30) was live-reconciled, not re-derived.
**Live probes run this session:** Fly status/releases, `/api/health`, marketing site, app + admin-hub gates, PR mergeability + CI rollups, branch protection, workflow runs, committed-secrets scan, PocketPM tree (84 nodes).

---

## 0. Bottom line (BLUF)

**YCM is close — the platform is deployed, healthy, and actively shipping (Fly v145 released 16 min before this probe; migrations auto-run on deploy; uptime monitor green every 5 min). What blocks production is not missing architecture — it is (a) a stalled merge pipeline rotting ~18 substantive PRs including the whole Connecticut-compliance suite, (b) an unverified end-to-end money loop on the real Cherry Hill ledger, and (c) five one-time William actions (email domain, Stripe live confirm, Sentry DSN, Neon confirm, compliance attestation) that gate everything downstream.**

The fleet can drain most of this without William. This audit filed the drainable work as eligible dispatches (§6) and registered the requirement-of-record in PocketPM (§5).

---

## 1. Decision surface — what William actually needs to decide

1. **Unblock the merge pipeline (recommend: YES, fleet does it).** All feature PRs fail the same Playwright check (stale self-hosted runner holding port 5000 — founder-os#8320). The fix PRs (#356, #359) are green and only need review+merge (branch protection requires 1 review). Everything else queues behind this. *Dispatched.*
2. **The CT-compliance suite (5 PRs, #288–#296, conflicting since 06-28) — re-land or re-scope?** Recommend: fleet rebases + re-lands behind the CI fix; these are the "Statecraft" moat (see Opportunities). *Dispatched as rebase/re-land work.*
3. **The five [William action] items W-2…W-6 (#221–#225)** — transactional-email domain (SPF/DKIM/DMARC), Stripe Connect live + CHC connected account confirm, `SENTRY_DSN`/GA4 Fly secrets, Neon migration confirm + old-Postgres destroy, CT-CIOA attestation. These are credential/founder-authority items only William can do; they gate observability (#208), deliverability (#215), onboarding completeness (#213), and the live money loop (#204). **These are the single highest-leverage ~1 hour of William time in the product.**
4. **Amenity money loop (issue #329)** — live fee/deposit capture at the source is a design+ratify item per the owning GM's own triage. Not dispatched as build; needs a design round. *(design-pending)*
5. **Pricing page v2 (issue #101 / founder-os#1321)** — spec exists (`docs/specs/pricing-model-v2-2026-05-10.md`) but the dispatch is labeled deferred-post-CHC. Decision: keep deferred or pull forward now that marketing site is live. *(design-pending / William call)*

---

## 2. Reconciliation of the prior readiness pass (live-probed 2026-07-03)

| Item | State today (probed) |
|---|---|
| P0-2 receipts email (#205), P0-4 reconciliation SoT (#207), P1-5 late fees (#212), P2-1 ledger edge cases (#216), P2-2 mobile money screens (#217) | **CLOSED — done.** |
| P1-2 uptime monitoring (#209) | **Largely STALE** — `uptime-monitor.yml` runs green every 5 min against `/api/health` (added per founder-os#2470). Residual: confirm alert routing actually reaches William. |
| P0-1 money-loop E2E on CHC (#204), P0-3 owner statement (#206), P1-1 Sentry/GA4 (#208), P1-3 backup/restore runbook (#210), P1-4 rate limiting (#211), P1-6 owner onboarding 18/18 (#213), P1-7 roles audit (#214), P1-8 deliverability (#215), P2-3 document storage (#218), P2-4 announcements E2E (#219), P2-5 month-close (#220) | **STILL OPEN — confirmed real.** Now dispatched (§6) except the William-gated parts. |
| W-2…W-6 (#221–#225) | **All OPEN** — William-action; see decision surface. |

---

## 3. What's genuinely working (live-verified, honesty section)

- **Deploy pipeline is real and current** — Fly release v145 completed 16 min before probe; `release_command = node scripts/migrate.cjs` runs migrations before machines roll (the silent-skip class of failure is closed); `/api/health` returns migration-journal parity (52/52 hashes).
- **Uptime monitoring live** — GH Actions ping every 5 min, green.
- **No committed payment secrets** — repo-wide scan found only the client-side Google Maps key (see R-findings) and documented placeholders.
- **Payments hardening landed** — idempotency, app-fee refunds, ACH return handling (PR #304 merged); receipts (#205) and reconciliation single-source (#207) done.
- **CI exists and gates** (typecheck + vitest + Playwright), branch protection requires review — the pipeline is strict; its current failure is one infrastructural bug, not absence of discipline.
- **PocketPM tree is current** — 84 nodes, statuses broadly match code reality.

---

## 4. Findings — three axes

Severity: **P1** = blocks production / real money-or-data risk · **P2** = material · **P3** = minor.

### 4.1 GAPS (functionality + pipeline)

| # | Sev | Finding | Evidence | Fix |
|---|---|---|---|---|
| G-1 | P1 | **Merge pipeline stalled: every feature PR fails the same Playwright check** (stale self-hosted runner, port 5000/AirPlay) — 18 non-dependabot PRs open, oldest substantive from 06-13 | founder-os#8320; PRs #342/#344/#305/#288–#296 all `FAILURE: Playwright`; fix PRs #356+#359 GREEN but unmerged (need 1 review) | Merge #356+#359, verify next PR run green |
| G-2 | P1 | **CT-compliance suite built but rotting** — resale certs (§47-270), assessment liens (§47-258), budget ratification (§47-261e), records retention (§47-260), reserve disclosure: 5 PRs now CONFLICTING/DIRTY since 06-28 | PRs #288, #290, #292, #293, #294, #296 `mergeable:CONFLICTING` | Rebase on main, resolve, re-land behind G-1 |
| G-3 | P1 | **End-to-end money loop never verified on CHC's real 18-unit ledger** — all pieces merged, no single documented run | Issue #204 (open); go-live gates A.6–B.3 manual+unverified | Scripted sandbox-rail run + documented evidence |
| G-4 | P1 | **No owner-facing account statement** — portal shows balance/activity, not the period statement a treasurer produces | Issue #206 (open) | `GET /api/portal/statement?period=` + printable render |
| G-5 | P2 | **Refund/reversal module has no live route** — tested authority exists (server/services/payment-edge-cases.ts) but no admin endpoint calls it | Issue #286 | Wire admin route + UI action |
| G-6 | P2 | **Dark mode renders light surfaces** — brand-v2 token migration left `.dark` body at rgb(248,249,250); a11y-dark-mode spec parked as fixme | Issue #352 | Fix tokens, re-enable Wave 46 spec |
| G-7 | P2 | **Month-close workflow absent** — reconciliation is transaction-by-transaction; no period lock/attestation | Issue #220 | "Close month" view + attestation |
| G-8 | P2 | **13 dependabot PRs open** (some security-relevant: nodemailer 8→9, multer, ws, form-data) | PR list probe | Batch-review, merge behind G-1 |
| G-9 | P2 | **security-compliance-calendar.yml fails to parse on every push** — red noise on every commit; masks real failures | Issue #355; live run 2026-07-03T17:11 failed | PR #359 fixes; merge+verify |
| G-10 | P2 | Amenity money loop incomplete at the source — live fee/deposit capture not built, GL sync orphaned | Issue #329 (GM triage: design+ratify first) | Design round, then build *(design-pending)* |
| G-11 | P2 | Document storage surface for governing docs unconfirmed for day-one set | Issue #218 | Verify + close gaps in documents.tsx |
| G-12 | P2 | All-owner announcement send unverified end-to-end (consent/unsubscribe) | Issue #219 (deps: W-2) | Verify post-W-2 |
| ~sub-agent product findings merged below in §4.4~ | | | | |

### 4.2 RISK (security · data-loss · payments · SPOF · cost)

| # | Sev | Finding | Evidence | Fix |
|---|---|---|---|---|
| R-1 | P1 | **Production errors are unobserved** — Sentry wired but no-op until `SENTRY_DSN` set; an unobserved 500 on a payment flow with real owners | Issue #208; fly.toml `VITE_SENTRY_DSN=""` | W-4 (William) then verify capture |
| R-2 | P1 | **Backup posture unverified for money data** — Neon PITR assumed, restore never tested; only a one-off `backup_before_switch.dump` in repo | Issue #210 | Tested restore + runbook |
| R-3 | P1 | **Rate limiting on 3 of ~612 routes** — financial-write + admin endpoints unthrottled; in-memory limiter won't survive a 2nd machine | Issue #211 | Limit financial-mutation + auth-adjacent routes |
| R-4 | P1 | **Role-gating on financial-mutation routes unaudited** — a non-treasurer board member posting payments/altering ledgers is unverified | Issue #214; PR #305 (scope-down) unmerged | Audit + tests; merge #305 |
| R-5 | P2 | **Google Maps API key committed** in fly.toml + INSTALL-OBSERVABILITY.md — client-exposed by design, but restriction state unverified (quota-runaway/abuse risk) | fly.toml:32 | Verify referrer restriction + quota cap in Google console; rotate if unrestricted |
| R-6 | P2 | **Single-machine SPOF economics** — min_machines_running=1, shared-cpu-1x/512MB; second machine exists but stopped w/ warning | fly status probe | Health-check the stopped machine; document scale posture |
| R-7 | P2 | **Email deliverability unverified** — receipts/OTPs/notices may land in spam; blocks owner onboarding | Issue #215 (deps W-2) | Post-W-2 verification |
| ~sub-agent server findings merged below in §4.4~ | | | | |

### 4.3 OPPORTUNITIES (growth · differentiation · moat)

Grounded in existing YCM assets already read this session (the CT-compliance suite, the AI-ingestion module, community public pages, per-door billing) and the founder-os captured-ask corpus (30+ open YCM dispatches/research findings).

| # | Opportunity | Value (unlocks) | Effort | Moat / differentiation | Evidence |
|---|---|---|---|---|---|
| O-1 | **Statutory-compliance-as-a-product, per state** ("Statecraft") | A defensible reason a self-managed HOA picks YCM over AppFolio/Buildium: the platform *knows CT law* (resale certs §47-270, liens §47-258, budget owner-veto §47-261e, records retention §47-260) and auto-generates the statutory documents. Expandable state-by-state. | L (per state) | High — incumbents are generic; none ship state-statute-aware workflows. YCM already built the CT suite (5 PRs). | PRs #288–#296; "Project Statecraft — 50-State Platform" artifact (PR #253); founder-os#1035 CIOA audit |
| O-2 | **AI document ingestion as the onboarding wedge** | A new self-managed board uploads its existing PDFs (bylaws, budgets, owner roster, ledgers) and YCM auto-extracts them into structured records — collapsing the painful data-entry that kills small-HOA onboarding. | M | High — the ingestion module + human-in-the-loop review queue is already `live` in the PPM tree; competitors make you hand-key everything. | PPM module `c8b8dace` (AI Document Ingestion, live); `benchmark:ingestion` script |
| O-3 | **Transparent, tiny-HOA-honest pricing** | Small self-managed HOAs (<50 units) are AppFolio/Buildium's worst-served segment (priced/built for PM companies). A published per-unit price with no sales call is a direct-acquisition lever. | S | Medium — pricing is a positioning moat, not a tech one; but it fits the founder-led CHC distribution. | Issue #101, founder-os#835/#1218/#1321 (pricing research already done); competitor gap |
| O-4 | **Reconciliation + bank-feed automation as the treasurer's killer feature** | The single most-hated volunteer-treasurer job is monthly reconciliation. YCM has bank-feed sync + reconciliation SoT (#207 done) + (once #8540 lands) month-close attestation — a "your books are closed in one click" story. | M | Medium-high — turns a compliance chore into the product's daily-active hook (retention). | PPM `a724b625` (Payment Reconciliation, in-progress); issue #220; PR #300 harness |
| O-5 | **Compliance-attestation trust surface for boards** | A board-facing "you are X% compliant with CT CIOA" dashboard (records retention current, reserve disclosure filed, budget ratified) turns the compliance engine into a visible, board-reassuring artifact — and a renewal/upsell anchor. | M | High — pairs with O-1; no competitor surfaces statutory posture as a score. | founder-os#351 (Compliance Operations Dashboard WS10); the CT suite |

### 4.4 Deep-dive code findings (server + product sub-agent sweep)

**Honest status:** the three parallel deep-dive sub-agents (server/security, product-functionality, opportunity) were launched but did NOT return before a transient server rate-limit (HTTP 529) interrupted this session; on resume they had not completed and were not re-run to avoid a second stall. The findings in §4.1/§4.2/§4.3 above are therefore sourced from **direct evidence this auditor verified** — live probes, the reconciled prior-readiness issue set (#204–#225, which was itself a code-anchored pass), the committed-secrets scan, PR/CI state, and the PocketPM tree — NOT from the deep sub-agent code sweep. A **line-by-line server-route + client-journey code sweep remains a recommended follow-up** (filed conceptually as part of #8537's role-matrix work, which forces a per-route middleware read). This is flagged so nothing is over-claimed: the audit's *pipeline/config/readiness* layer is well-verified; a *fresh line-level source audit* was not completed this session.

### 4.5 Captured-ask themes + moat thesis

**Captured-ask themes** (clustered from 30+ open founder-os YCM dispatches/research findings):
1. **Compliance-as-differentiation** — CT CIOA suite, 50-state platform, compliance ops dashboard (#8013–#8017, #253, #351, #1035). The single densest cluster.
2. **Pricing / go-to-market** — pricing v2/v3, per-door vs per-complex, competitive landscape, first-five-customer strategy (#101, #835, #1215–#1221, #1321, #2525). Research done, builds deferred-post-CHC.
3. **CHC go-live gating** — Stripe Connect onboard, money-loop verification, owner onboarding, MVP scope with the real customer (#971, #204, #17, #390). The near-term critical path.
4. **AI everywhere** — universal AI assistant per tier, AI ingestion (#988). Under-pressed relative to its built state.

**Moat thesis:** YCM's defensible position is **the statute-aware, self-managed-HOA platform** — it wins not by out-featuring AppFolio/Buildium (built for PM companies) but by owning the segment they underserve (tiny self-managed boards) with two things incumbents lack: (1) **state-statutory-compliance built into the product** (the CT suite → 50-state), and (2) **AI document ingestion that makes onboarding painless**. Founder-led CHC distribution is the proof point; transparent pricing is the acquisition lever. The compliance engine is simultaneously the differentiation AND the retention/renewal anchor.

---

## 5. PocketPM requirement-of-record (registered this session)

Initiative **"Production Readiness — Cruise-Prep Finishing (2026-07-03)"** `4f2a2a1e-a5e9-446d-9aa0-71597b2bfc95` (code PRODREADY) under workstream "YourCondoManager (YCM) — Phase 1" (`5818bc2c`), product `1e2da109`. 14 children:

| PPM item | Node |
|---|---|
| `044a3707` | Merge-pipeline unblock (CI Playwright + workflow-parse) |
| `5c759386` | CT-compliance suite re-land (5 conflicting PRs) |
| `da6a70dd` | Owner-facing account statement |
| `15251267` | Money-loop E2E verification on CHC (sandbox rail) |
| `00563609` | Refund/reversal admin route |
| `92fda83f` | Rate-limiting coverage (financial + auth routes) |
| `ef32245e` | Financial-route role/permission audit |
| `11332b5d` | DB backup verification + restore runbook |
| `b8509412` | Dark-mode token repair |
| `1c112d64` | Treasurer month-close workflow |
| `bb656bdf` | Dependency-PR batch (13 dependabot) |
| `a5e1cbe4` | Governing-docs verification + Maps-key restriction |
| `ef5fcd68` | [design-pending] Amenity money loop source capture |
| `1a8d605f` | [william] One-hour unblock bundle (W-2…W-6) |
| `4af04459` | [william-gated] Post-W-2 verifications (#213/#215/#219) |

## 6. Fleet dispatches filed (eligible, ready-to-build — `williamruiz1/founder-os`)

All filed via `file-dispatch.sh` (fingerprint auto-stamped, admitted at intake, NO gating labels — verified post-file):

| Dispatch | Pri | Work |
|---|---|---|
| #8531 | P1 | Merge-pipeline unblock: land #356+#359, verify green, drain dependabot batch |
| #8532 | P1 | CT-compliance suite re-land (rebase + merge #288–#296) |
| #8533 | P1 | Owner-facing account statement (portal + admin, printable) |
| #8534 | P1 | VERIFY — money loop E2E on CHC ledger (sandbox rail, documented run) |
| #8535 | P2 | Refund/reversal admin route |
| #8536 | P1 | Rate-limiting coverage on financial-mutation + auth routes |
| #8537 | P1 | Financial-route role/permission audit + re-land PR #305 |
| #8538 | P1 | DB backup verification + restore runbook (Neon) |
| #8539 | P2 | Dark-mode token repair + re-enable a11y suite |
| #8540 | P2 | Treasurer month-close workflow |
| #8541 | P2 | Governing-docs verification + Maps-key restriction runbook |

**NOT dispatched (by design):** amenity money loop (#329 — design+ratify round first), pricing page v2 (#101 — deferred-post-CHC, William call), W-2…W-6 (#221–#225 — William credential/authority actions), post-W-2 verifications (#213/#215/#219 — gated on W-2).

## 7. Honest unverified items

- **Admin hub content** — `admin.yourcondomanager.org` gate answers 302 (edge auth up); page content/notification center NOT verified this session (no session cookie used).
- **Fly secrets state** (whether SENTRY_DSN/SMTP creds are set) — not probed; issue #208's premise taken from issue text + fly.toml build args.
- **Neon PITR configuration** — not probed (no Neon credential exercised).
- **Google Maps key restriction state** — needs Google console check (R-5).
- **Stopped Fly machine's 1 warning check** — not diagnosed.
