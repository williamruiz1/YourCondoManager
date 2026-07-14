# YourCondoManager (YCM) — Codebase Audit Final Report

**Protocol:** codebase-audit-protocol-v1
**Repository:** `williamruiz1/YourCondoManager`
**Ref audited:** `origin/main` @ `1e6f941` (baseline) / `bbb49aa` (specialist lanes) — see §Scope & Limitations
**Audit dates:** 2026-07-10
**Mode:** Static, read-only, four-phase audit (Baseline → System Map → 3 parallel specialist lanes → this synthesis). **Zero application code was modified.** No commits, no pushes, no `npm install`, no runtime execution, no production credentials used.
**Findings:** 51 total (1 critical, 16 high, 18 medium, 11 low, 5 informational) — full catalog in `findings.jsonl`.

---

## 1. Executive summary

YourCondoManager is a working, live, single-tenant (Cherry Hill Condos) financial SaaS product with a genuinely sound core: the primary owner-dues payment path uses correct Stripe idempotency keys, integer-cents math, a well-designed reconciliation matcher, and a fail-closed migration gate that already protects every deploy. That core is real and this audit confirms it (see §7 Positive findings).

But the audit also found **one critical, unverified live-money-integrity defect**, **16 high-severity findings — several of which are active in production today, not behind a feature flag**, and a consistent pattern across every specialist lane: the system's safety margins (tenant isolation, transaction atomicity, idempotency, deploy safety, error visibility) were engineered correctly on the *original, first-built* code paths and then **not consistently carried forward** as the system grew — new route modules, the newer amenity-money-loop feature, and the platform-billing passthrough each individually skip a safeguard the original dues-payment path has.

**Overall condition rating: MATERIAL RISK — remediation required before onboarding a second tenant and before enabling the currently-latent GL/amenity money-loop feature flags.**

This is not "healthy" and it is not "critical attention required" in the sense of an active, confirmed breach or data-loss event. It sits in between because:

- **What's live and needs fixing NOW, regardless of tenant count:** a critical defect where a single Stripe payment could post as a double or triple credit to Cherry Hill's real ledger (needs a 30-minute Stripe-dashboard check to confirm exposure, but the code will misbehave if it fires); every API response body — including auth tokens — is logged in plaintext to production logs today; production has no staging environment, deploys immediately on every merge with `--strategy immediate`, auto-runs schema migrations with no automated rollback, and has zero application error telemetry (Sentry is wired but inert).
- **What's currently low-impact but will become live risk on two near-term, already-planned triggers:** the tenant-isolation defects (a complete absence of scoping in one module, a fail-open helper in another) have almost no blast radius *today* because there is effectively one tenant — but YCM's own roadmap is to onboard more HOAs, at which point these become real cross-tenant data breaches. Similarly, the amenity money-loop's missing idempotency and non-atomic writes are inert only because the feature flag defaults off — the moment Cherry Hill (or anyone) is allowlisted, they become live money-integrity bugs.
- **What's structural and slows every future fix:** two files (`routes.ts` at 20.5k lines, `storage.ts` at 18k lines) hold 37% of the entire server and are the substrate under both the tenant-isolation gap (nobody can hold ~515 routes' scope logic in their head) and the review/merge-collision problem this very fleet has repeatedly hit building YCM.

The recommended posture is not "stop and rewrite" — it's "close the Wave 0/Wave 1 gaps immediately (days), harden Wave 2 before the two known triggers (tenant #2, GL flag flip), and treat the architecture cleanup as an ongoing, incremental background project."

---

## 2. System overview

One deployable service: an Express 5 API + a React 18/Vite SPA served by the same process, on Node 20, TypeScript ESM, backed by Drizzle ORM against Neon-hosted PostgreSQL. Deployed as a single Fly.io machine (`ewr`, auto-stop/start, 512MB) with a persistent volume for uploads. Money moves through Stripe (raw HTTP calls, no SDK) for owner dues, platform SaaS billing, and (newly, flag-gated) amenity fees/deposits; bank reconciliation runs through Plaid in sandbox. Auth is two disjoint systems: admin/staff via Google OAuth + Postgres sessions, and the owner/board portal via OTP-issued bearer header tokens. CI and production deploys both run on a single self-hosted Mac. There is no staging environment.

Full system map: `repository-map.md`. Full baseline + limitations: `audit-charter.md`.

## 3. Scope & limitations

- **Read-only, no runtime.** Every finding is a static-source fact. 10 of 51 findings are explicitly `needs runtime verification` or `candidate` — they describe a real, code-evident defect shape whose live blast radius depends on facts this audit could not check (Stripe dashboard event subscriptions, GCP console key restrictions, live Fly secrets, production row data, `pg_stat_statements`/`EXPLAIN` output). These are flagged, not silently treated as confirmed.
- **Shared-checkout limitation.** The canonical checkout at `~/code/YourCondoManager` was in a dirty, multi-agent, detached-HEAD state at audit time (88 dirty files across sibling worktrees). All audit work happened in clean, isolated worktrees pinned to `origin/main`, per `worker-worktree-isolation-protocol.md`. No in-flight branch work (redesign prototypes, pricing-v2, reconciliation-breadth branches) is reflected in this audit — scope is `main` only.
- **Commit drift.** The baseline (Phase 1/2) was pinned to `1e6f941`; the three specialist lanes independently landed on a slightly later `main` commit, `bbb49aa`, when they claimed their dispatches. This is normal for an actively-shipping repo and does not affect any finding's validity — see `coverage-matrix.md` §Scope note.
- **No production database, no Stripe/Plaid dashboard, no GCP console, no Fly.io runtime state, no npm install.** See `coverage-matrix.md` for the full per-domain coverage breakdown, including what was explicitly NOT inspected.
- **Repository integrity:** confirmed no code was changed by this audit. The only artifacts written are under `audit-output/`.

## 4. Findings summary

| Severity | Count |
|---|---|
| Critical | 1 |
| High | 16 (15 distinct after resolving the A-REL-006/CQ-001 duplicate pair to one HIGH item — see below) |
| Medium | 18 |
| Low | 11 |
| Informational | 5 |
| **Total** | **51** |

By status: 41 `validated` (confirmed by direct source read), 5 `needs runtime verification` (code-evident, live confirmation pending), 5 `candidate` (plausible signal, needs more data to promote).

Cross-lane duplicates are linked (not double-counted) in `coverage-matrix.md` — 7 clusters where two or three lanes independently found the same underlying issue (the Maps API key was found by all three lanes; the God-file monolith and the Sentry-inert findings were each found by two).

**Severity resolution:** `A-REL-006` (lane-a: low) and `CQ-001` (lane-c: high) assert the identical fact — the whole `server/` tree is unlinted. Resolved to **HIGH**: this is a total absence of static analysis on the highest-risk code (money, tenant-scoping, webhooks), not a narrow reliability nit. See `coverage-matrix.md` §Severity resolutions for full reasoning.

---

## 5. The critical finding, in full

### A-WEBHOOK-001 — A single owner payment can post to the ledger two or three times

**What:** The server has **three independent code paths** that each write a negative "payment" row to `owner_ledger_entries` — one from the per-HOA Stripe webhook endpoint, one from the autopay flow, one from the platform Stripe-Connect webhook. Each path checks for a duplicate using its **own, different** identity: the webhook's *event* id, the autopay *transaction* id, and the Stripe *charge* id, respectively. **None of the three is keyed on the underlying payment's actual identity** (the Stripe PaymentIntent). Both `checkout.session.completed` and `payment_intent.succeeded` — two DIFFERENT Stripe event types that can both fire for one successful payment — normalize to the same "succeeded" status and both attempt to post a ledger credit.

**Why it matters:** If Stripe is configured (in its own dashboard, not visible from code) to send both event types with payment metadata to the relevant endpoint(s), a single real payment from a Cherry Hill owner would be recorded as TWO or THREE payments — understating what that owner actually owes, corrupting the association's books, and breaking bank-deposit reconciliation.

**Why it's "needs runtime verification" and not just "confirmed":** whether both events actually arrive with the metadata needed to trigger the second write depends on Stripe's live endpoint subscription configuration, which this audit cannot see. **This is the single highest-value 30-minute check to run before anything else** — check the Stripe Dashboard's webhook endpoint configuration for which event types are subscribed, and whether metadata propagates to both. If confirmed, this is an active, currently-happening bug on the live customer's real books; if not confirmed today, it remains a landmine that a future dashboard config change (or a second Stripe endpoint) could trigger silently.

**Fix direction:** one canonical payment-identity idempotency key (the PaymentIntent id) shared across all three write paths, enforced by a database-level unique constraint (this closes A-WEBHOOK-002 at the same time, which is the same root gap triggered by concurrency instead of multi-event fan-out).

---

## 6. All 16 HIGH findings, detailed

### 6.1 Live in production TODAY (not behind a feature flag)

**A-SEC-001 — Every API response body is logged to production stdout, unredacted.** The Express request logger captures and JSON-stringifies every `/api` response and writes it to logs, with no production gate, no redaction, no truncation. This includes auth/OTP-verify responses (session tokens), financial records, owner PII, and Plaid data. Anyone with Fly log access reads all of it in cleartext, and any leaked auth token is directly replayable. *Fix cost: trivial (remove the body-append), effort XS, zero regression risk.*

**A-REL-004 / CQ-005 — No staging, immediate-strategy auto-deploy, auto-run migrations, no rollback.** Every merge to `main` deploys straight to the single production Fly machine with `--strategy immediate` (no canary), and the deploy pipeline auto-runs Drizzle schema migrations against the live database as part of the release. Migrations are forward-only — an `fly deploy` rollback reverts the app image but **not** a schema change. There is no pre-production environment where a bad merge or destructive migration is caught before it reaches Cherry Hill's real data. *This is the top structural amplifier of every other finding in this list — whatever else breaks, it breaks in production, instantly, for everyone, with no undo.*

**CQ-004 — Single self-hosted Mac runner is the sole CI + deploy host, and it has already gone offline mid-run.** All four CI jobs (typecheck, test, build, Playwright) and the production deploy itself run on one physical Mac. This isn't a hypothetical — it was directly observed offline during a real PR (#10172, 2026-07-09), blocking all merges and deploys for the product until it came back.

**CQ-003 — The dependency-vulnerability CI gate blocks on CRITICAL CVEs only.** A dependency vulnerability rated "high" (which can mean auth bypass or remote code execution, just not the top tier) is only labeled on the PR, not blocked — it can merge and auto-deploy same as anything else, given CQ-005's finding.

**A-AUTH-001 — The owner/board portal's session token is a permanent, non-rotating, non-revocable database primary key.** The bearer credential sent on every portal request never expires under active use, has no logout/revocation endpoint, and is a JS-readable header rather than an httpOnly cookie. It's high-entropy (not guessable), but if it ever leaks — via a proxy log, an XSS, a shared device, a screenshot — the leak grants unbounded-duration full portal access with no way to revoke it short of a database edit. *This is the largest single remediation effort in the whole backlog (XL) because it's the core portal auth mechanism touching dozens of routes and the client — it needs a phased migration, not a quick patch.*

**A-SEC-002 / COST-B-004 / CQ-012 — A live Google Maps API key is committed in `fly.toml` and in a doc, in git history.** All three specialist lanes independently found this. Whether it's currently abusable depends on whether it's referrer-restricted in the Google Cloud console (not verifiable from the repo) — but it's committed either way, so rotation requires a code change and it can never be fully scrubbed from git history.

**ARCH-B-001 / CQ-002 — Two files, `routes.ts` (20,566 lines) and `storage.ts` (18,036 lines), hold 37% of the entire server.** ~515 routes and the entire tenant-scoping logic live in one file with no module boundary. This is the substrate under the tenant-isolation gap (nobody can review 515 route handlers' worth of scoping logic by eye) and behind this very fleet's own repeated YCM merge collisions.

**CQ-001 (severity resolved from lane-a's LOW) — The entire `server/` tree — all payment, webhook, and tenant-scoping code — is never linted.** `npm run lint` only scans `client/src`. Not a style nit: this means zero static analysis (no floating-promise detection, no unused-variable detection, no exhaustive-switch checking) has ever run against the money-critical half of the codebase.

**A-OPS-003 / CQ-009 — Error tracking (Sentry) is wired in code but produces nothing in production.** The SDK packages aren't even installed (`@sentry/node`/`@sentry/react` absent from `package.json`), and the DSN build args are empty. Combined with A-SEC-001 (the only thing that IS logged leaks PII), the operational reality today is: a payment-flow exception in production is invisible until a resident calls to complain.

**DATA-B-009 — Money-moving multi-row database writes are not wrapped in transactions, anywhere, except one unrelated non-money import path.** A repo-wide search found exactly one use of `db.transaction(` in the entire server, and it's in the RAG document ingester, not anywhere near money. The clearest live consequence: importing a bank statement loops through each transaction and writes a ledger entry per row with no enclosing transaction — a crash mid-loop leaves a **partially-imported statement with no rollback**.

**PERF-B-002 — The database connection pool has no configured maximum, so it silently defaults to 10 connections for the entire process.** Shared by every HTTP request AND the periodic automation sweep, against a configured 250-concurrent-request limit at the edge. Under real load this surfaces as random-looking request timeouts.

**SCALE-B-003 — Six background schedulers rely on in-process memory to prevent double-firing, with zero cross-machine locking.** This is safe *only* because Fly is currently pinned to exactly one running machine. The moment a second machine runs — planned scale-out, or simply an overlapping window during a rolling deploy — every timer fires on every machine simultaneously: autopay could double-charge owners, delinquency notices could double-send, and assessments could double-dispatch. The codebase already has the right fix pattern in one other file (`bank-feed-sync.ts` uses a Postgres advisory lock) — it just wasn't applied to these six.

### 6.2 Live only when a currently-off feature flag is switched on, or a second tenant is onboarded

**A-AUTHZ-001 — The tenant-isolation helper `assertResourceScope` fails OPEN, not closed, when it can't determine which HOA a resource belongs to.** Nine resource types (governance templates, notice templates, communication history, AI-extracted records, and others) have a database column that's allowed to be empty — and when it is, the check silently ALLOWS access instead of denying it. A sibling function in the same file was already hardened to fail closed for exactly this reason; this one wasn't. Today's blast radius is small because there's effectively one tenant. It stops being small the moment there are two.

**A-AUTHZ-002 — One entire route module (Connecticut §47-260 records requests — legally regulated owner records) has zero tenant-isolation checks of any kind.** Not a subtle edge case: every route in this module reads or writes by raw ID with no scope check at all. Any admin of any HOA can currently read, modify, or create another HOA's regulated owner records. This is the single most deterministic, most confidently-confirmed cross-tenant hole in the audit — and the cheapest of the high-severity AUTHZ findings to fix, because it just needs the existing (correct) central scope-check pattern applied, which several other modules already do correctly.

**A-REL-006 (see CQ-001 above — same finding, one item).**

---

## 7. Positive findings (confirmed, not assumed)

Two lanes explicitly went looking for money-integrity gaps the audit brief hypothesized, and cleared them with evidence — worth reporting alongside the problems, per the audit's own fact-vs-hypothesis discipline:

- **POS-B-007 — Every money-moving Stripe call that was checked (checkout, off-session charges, the amenity gateway) DOES carry a proper Idempotency-Key.** The double-charge-on-retry risk hypothesized for the "no SDK, raw fetch" pattern is largely refuted for the core, original dues-payment paths. (It is *not* refuted for the newer amenity forfeit/refund calls or the platform-billing passthrough — see A-STRIPE-001 and A-STRIPE-004.)
- **POS-B-008 — The bank-feed reconciliation matcher is well-designed.** Integer-cents money math, confidence-scored matching, a conservative 0.85 auto-apply threshold with human review below it, and an explicit conflict rule for ambiguous matches. This holds up.
- **A-TEST-001 / CQ-011 — Test-only routes are correctly, triple-gated, and unreachable in production.** A mapper hypothesis was raised and cleared with direct evidence by two separate lanes.
- **The migration gate is real and already working.** `fly.toml`'s `release_command` runs the migration script on a dedicated pre-deploy step and **aborts the whole deploy if it fails** — this is a genuine safety mechanism already in place, even though it only protects against migration *failures*, not against a *successful but destructive* migration (see A-REL-004).

---

## 8. Systemic root causes

Six findings clusters trace back to a small number of underlying patterns. Fixing the root cause prevents the next instance from being found in the *next* audit instead of this one.

1. **Tenant-isolation enforcement is a per-call-site convention, not a structural guarantee.** The core guards (`assertAssociationScope`, `getAssociationIdQuery`) are correct and were already hardened once. But nothing forces every route module to call them — several newer modules hand-roll their own database queries and simply never call the guard. (A-AUTHZ-001, -002, -003, -004, CQ-010.) This is amplified by root cause #4 below: a 20.5k-line file has no seam to hang a structural check on.

2. **Zero transaction-atomicity discipline for money-moving writes.** `db.transaction(` is called exactly once in the entire server, and it's not near money. Every "charge Stripe, then write the database" or "loop and insert N ledger rows" sequence is a chain of independent, non-atomic steps — so any crash, timeout, or restart mid-sequence leaves partial financial state with no automatic recovery. (DATA-B-009, A-STRIPE-002, and the concurrency half of A-WEBHOOK-002.)

3. **No pre-production environment or promotion gate between a merge and Cherry Hill's live money.** The entire safety net between a code change and production is: one human code review, four CI checks on one physical Mac (one of which — E2E/visual/accessibility — isn't even required to pass), a dependency scanner that only blocks the worst-tier CVEs, then an immediate, no-canary deploy that auto-runs schema migrations with no rollback path, with no application error telemetry to catch what slips through. (A-REL-004, CQ-003, CQ-004, CQ-005, CQ-006, A-OPS-003/CQ-009.)

4. **Two 18–20k-line "God files" concentrate 37% of the server with no module boundary.** This is the physical substrate underneath root causes #1 and #3: it's why nobody can hold the full set of tenant-scoping call sites in their head during review, why the lint gap (CQ-001) is so consequential, and why this very audit fleet has repeatedly hit merge collisions building YCM. (ARCH-B-001/CQ-002.)

5. **Idempotency and replay-protection were built correctly once, on the original dues-payment path, and then not carried forward as a shared, enforced pattern.** The core Stripe checkout flow has the right idempotency keys (confirmed, POS-B-007). The newer amenity-deposit forfeit/refund calls don't. The platform-billing passthrough doesn't. The webhook signature verifiers never check event freshness (replay window). The ledger table has no database-level unique constraint backing its idempotency check — it's application-level check-then-insert, which races under concurrency. Each of these is the same underlying lesson learned in one place and not generalized. (A-STRIPE-001/004/005, A-WEBHOOK-002/003, CQ-008.)

6. **Single-machine assumptions are baked into scheduling and locking with no cross-process guard, in a codebase that already knows the correct fix pattern.** Six background schedulers rely on in-process memory for exclusivity; only one other file (`bank-feed-sync.ts`) uses the Postgres advisory-lock pattern that would fix all of them. It's currently safe only because of a Fly.io config setting (`min_machines_running = 1`), not because of application-level correctness. (SCALE-B-003, A-REL-005, and PERF-B-002 as an adjacent capacity concern.)

## 9. Stale/unused code assessment

No dead-code or unused-dependency findings are asserted in this audit. Lane-c explicitly declined to make unconfirmed dead-code claims, noting that reliable detection requires dynamic/route/config/flag-use tracing that was out of budget for this pass. Twenty-nine `TODO`/`FIXME`/`XXX`/`HACK` markers were located and enumerated (CQ-013, low severity) — a handful sit in money-adjacent server code (bank-feed sync, payment-receipt email) and are worth triaging into tracked issues, but none were individually classified as stale-vs-live. **A dedicated dead-code/stale-flag detection pass is a recommended follow-on audit**, not something this pass could responsibly assert.

## 10. Performance & cost opportunities

- **PERF-B-002** — set an explicit connection-pool `max` sized against Neon's actual plan limit; currently silently capped at 10.
- **DB-B-005** (candidate) — a low index-to-table ratio (47 indexes / 183 tables) suggests missing composite indexes on the hot `association_id + status + date` query shapes that dominate a multi-tenant financial app's read path. Needs `EXPLAIN`/`pg_stat_statements` against real usage to promote from candidate to validated — do not guess at which indexes to add.
- **STARTUP-B-006** (needs runtime verification) — the database is re-seeded on every process boot (4,257-line seed script), adding cold-start latency after Fly's auto-stop and carrying a correctness risk if any seed write isn't idempotent.
- **COST-B-004 / A-SEC-002 / CQ-012** — the committed, possibly-unrestricted Google Maps key is a live quota-theft/billing-abuse exposure until confirmed restricted in the Google Cloud console.

## 11. Test/regression gaps

- **CQ-010** — no systematic, route-inventory-driven test asserting every one of ~515 routes enforces tenant scoping. Targeted security tests exist for specific areas (financial, Plaid, alerts) but the single highest-severity risk class in the whole audit (cross-tenant data access) has no comprehensive regression net.
- **CQ-006** — the Playwright suite (route-mocked, real-backend, accessibility, and visual-regression E2E) is not a required check on `main` — it can be red and a PR still merges.
- **CQ-001/A-REL-006** — no static analysis coverage on `server/` at all (see §6.1).
- Multiple individual findings (A-WEBHOOK-001, A-STRIPE-001/002/003, DATA-B-009, A-RECON-004/006) each name specific missing tests in `findings.jsonl` — a fault-injection / concurrent-delivery / partial-failure test class is conspicuously absent across the money-writing paths generally, not just for one finding.

## 12. Operational/observability gaps

- No application error telemetry in production (A-OPS-003/CQ-009) — Sentry is code-complete but not installed/configured.
- Every response body is logged, but that's the *wrong* kind of visibility (A-SEC-001) — it's a liability, not observability.
- Single CI/deploy runner with no redundancy, already observed failing (CQ-004).
- No staging environment to smoke-test a deploy before it reaches Cherry Hill (A-REL-004/CQ-005).
- The one genuinely good operational signal in the audit: `/api/health`'s migration-hash integrity check (503 on drift) and the weekly independent `pg_dump` backup — both real, both already working.

## 13. Recommended remediation sequence

Full detail, ownership, effort, dependencies, and rollback requirements for every finding are in `remediation-backlog.md` and `remediation-backlog.csv`. Sequence, in brief:

- **Wave 0 — immediate containment (days).** Verify and close A-WEBHOOK-001 (the critical finding) together with A-WEBHOOK-002 and A-WEBHOOK-003 (same code, same PR family); stop logging response bodies (A-SEC-001). All four are cheap-to-medium effort and address exposure that is live in production **today**, independent of tenant count or feature flags.
- **Wave 1 — tests, telemetry, backups, deploy-safety (before any risky cleanup begins).** Close the no-staging/immediate-deploy/no-rollback gap, the single-runner SPOF, the critical-only CVE gate, the non-required Playwright gate, get Sentry actually reporting, extend lint to `server/`, build the tenant-isolation regression-test harness, rotate/restrict the Maps key, fix the DB pool size, and add the cross-machine scheduler locking. This wave exists specifically so that Waves 2 and 3 — which touch the riskiest code — have a real safety net (tests, telemetry, a rollback path) underneath them before they start.
- **Wave 2 — high-impact security/reliability/perf.** Fix the tenant-isolation fail-open and zero-isolation defects (leading with A-AUTHZ-002, the most deterministic and cheapest of the group); add idempotency to the amenity forfeit/refund and platform-billing Stripe calls; wrap money-moving multi-row writes in real database transactions; rebuild the portal bearer-token mechanism to rotate/expire/revoke (the largest single item, phase it); fix the reconciliation and refund/dispute ledger-reversal gaps; migrate ledger money columns off single-precision float. **Sequence this wave to finish before onboarding a second tenant and before flipping any GL/amenity-money-loop feature flag** — that is the trigger that converts these from "latent design defects" into "live incidents."
- **Wave 3 — architecture/maintainability.** Incrementally decompose `routes.ts`/`storage.ts` into per-domain modules, move-only, with a route-inventory diff as the safety net for every extraction PR — sequenced AFTER Wave 1's regression tests exist, so decomposition can't silently reopen a tenant-isolation hole. Fold in the type-safety escape-hatch cleanup as each file is touched, and a data-driven (EXPLAIN-verified) indexing pass.
- **Wave 4 — validated stale/dead-code removal.** Intentionally thin this round — no dead-code findings were validated. Triage the 29 TODO/FIXME markers; commission a dedicated dead-code/stale-flag detection pass as a follow-on audit before this wave can be meaningfully populated further.

## 14. Overall condition rating

**MATERIAL RISK — remediation required before further scale.**

Justification, weighted per instruction toward money-path integrity, tenant isolation, and deploy safety (the three categories that matter most for a live-customer financial SaaS):

- This is **not** "Healthy" or "Generally sound": there is one unverified but code-confirmed critical live-ledger-integrity defect, plaintext logging of auth tokens and financial PII in production today, and zero staging/rollback/error-telemetry standing between a bad merge and Cherry Hill's real books — all currently active, none behind a flag.
- This is **not** "Critical attention required" in the sense of a confirmed, ongoing breach or data-loss event: the core dues-payment path has correct idempotency (confirmed positive finding), the migration gate genuinely blocks bad migrations from partially applying, weekly independent backups exist, and the two most severe tenant-isolation holes have near-zero *current* blast radius because the product is effectively single-tenant today.
- It lands at **Material Risk** specifically because of the combination: real, live, unconditional exposure that needs Wave 0/1 fixed regardless of anything else, PLUS a cluster of high-severity defects that are currently latent only because of two conditions the business plan explicitly intends to change soon — onboarding additional HOAs, and turning on the amenity/GL money-loop feature. Proceeding to either of those triggers without Wave 2 remediation would predictably convert several "design defect, bounded exposure" findings into real cross-tenant data breaches or real double-charged/double-recorded HOA money — not hypothetically, but as the direct, demonstrated behavior of the code as written.

The path back to "Improvement needed" or better is concrete and bounded: Wave 0 is days of work; Wave 1 is weeks and mostly config/process, not risky code surgery; Wave 2 is the real engineering lift and should be substantially complete before the two known triggers fire.

## 15. Repository integrity confirmation

Confirmed: no application code, configuration, or dependency file was modified, committed, or pushed by this audit. All work occurred in isolated, read-only worktrees pinned to `origin/main` (per `worker-worktree-isolation-protocol.md`). The only artifacts produced are the four files under `audit-output/` plus the intermediate `findings-{a,b,c}.jsonl` / lane reports that were merged into the canonical `findings.jsonl`.

---

## Deliverables index

| File | Purpose |
|---|---|
| `audit-charter.md` | Phase 1 baseline: repo/ref, stack, deploy targets, correction to audit brief (no staging environment exists) |
| `repository-map.md` | Phase 2 system map: routes, auth, DB, integrations, feature flags, infra, trust boundaries, top-10 risk ranking |
| `agent-reports/mapper-summary.md` | The mapper's top-10 risk handoff to the specialist lanes |
| `agent-reports/lane-{a,b,c}-report.md` | Per-lane findings summary + coverage + uncertainty |
| `findings.jsonl` | Canonical, merged 51-finding catalog (source of truth for everything in this report) |
| `coverage-matrix.md` | This synthesis's per-domain coverage matrix + duplicate/severity resolution log |
| `final-audit-report.md` | This document |
| `remediation-backlog.md` | Human-readable remediation backlog, organized by wave |
| `remediation-backlog.csv` | Machine-readable remediation backlog, one row per finding |
