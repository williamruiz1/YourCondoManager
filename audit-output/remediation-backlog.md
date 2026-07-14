# Remediation Backlog — YourCondoManager (YCM) Codebase Audit

**Source:** `findings.jsonl` (51 findings, canonical). **Machine-readable version:** `remediation-backlog.csv`.

Every row below maps 1:1 to a finding already present in `findings.jsonl` — nothing here is invented. Findings describing the same underlying defect (see `coverage-matrix.md` §Cross-lane duplicates) are grouped so they land in one PR, but each keeps its own row/ID for traceability.

---

## Wave 0 — Immediate containment of critical risk (days)

Everything in this wave is either already live in production and exploitable/leaking today, or is the single highest-value cheap check in the whole audit. Fix these first, in parallel with starting Wave 1's design work. All four items touch the same webhook/logging code paths and are sized to land as 1-2 PRs within days.

**4 finding(s) in this wave.**

### `A-WEBHOOK-001` — Owner-ledger payment writes use disjoint idempotency namespaces keyed on webhook-event-id/transaction-id, not payment identity — one real payment surfacing as multiple Stripe events (or across both webhook endpoints) posts multiple negative ledger entries (double/triple credit)

- **Severity:** CRITICAL (needs runtime verification) · **Priority:** P0 · **Effort:** L · **Domain:** webhook/ledger · **Discovered by:** lane-a
- **Component(s):** server/routes.ts /api/webhooks/payments; server/storage.ts processPaymentWebhookEvent; server/services/stripe-reconciliation.ts writeLedgerEntryForCharge; server/routes/stripe-connect.ts platform Conn
- **Recommended owner:** YCM backend eng (money/ledger) + William (Stripe dashboard access)
- **Dependencies / sequencing:** Runtime-verify Stripe event subscriptions FIRST (cheap, ~30 min) before code changes; blocks/informs A-WEBHOOK-002 fix grain.
- **Regression risk:** Medium-high — consolidating three write paths and adding a unique constraint requires backfilling/deduping any existing duplicate rows and careful handling of legacy charges lacking a PI id; a too-narrow key could drop legitimately distinct payments.
- **Required tests:** POST checkout.session.completed + payment_intent.succeeded for one PI → exactly one ledger credit; per-HOA payment-webhook + platform stripe_charge for one charge → exactly one credit; autopay succeeded → exactly one credit; unique-constraint violation path returns idempotent success not 400
- **Rollback requirements:** N/A — read-only Stripe Dashboard check first; code fix is additive (new unique key/constraint), revert via git if it rejects legitimate distinct payments.

### `A-SEC-001` — Full JSON response bodies of every /api request logged to stdout in production (PII + auth tokens leak)

- **Severity:** HIGH (validated) · **Priority:** P0 · **Effort:** XS · **Domain:** secrets · **Discovered by:** lane-a
- **Component(s):** server/index.ts request-logging middleware; server/logger.ts
- **Recommended owner:** YCM backend eng
- **Dependencies / sequencing:** Ship same-day; zero dependencies.
- **Regression risk:** Very low — removing the body-append is behavior-preserving for the app; only reduces log verbosity.
- **Required tests:** assert log line for an /api request contains no response-body content in production mode; assert a verify-login response token never appears in captured log output
- **Rollback requirements:** Trivial revert (restore the JSON.stringify line) — zero functional risk either direction.

### `A-WEBHOOK-002` — Owner-ledger idempotency is check-then-insert with NO unique DB constraint on (referenceType, referenceId) — concurrent duplicate webhook deliveries can race past the existence check and double-insert

- **Severity:** HIGH (validated) · **Priority:** P0 · **Effort:** M · **Domain:** ledger · **Discovered by:** lane-a
- **Component(s):** server/services/stripe-reconciliation.ts writeLedgerEntryForCharge; server/routes.ts autopay ledger block; shared/schema.ts owner_ledger_entries
- **Recommended owner:** YCM backend eng (money/ledger)
- **Dependencies / sequencing:** Ships together with A-WEBHOOK-001 — same canonical idempotency key.
- **Regression risk:** Medium — a unique index will fail if pre-existing duplicate rows exist; must dedupe historical data first. Some referenceType values (e.g. manual adjustments) may legitimately share referenceId=null and must be excluded via a partial index.
- **Required tests:** concurrent duplicate charge.succeeded → single ledger row; payout.paid belt-and-suspenders after charge.succeeded → no second row; migration guard rejects/dedupes pre-existing duplicates
- **Rollback requirements:** Migration adds a partial unique index; must dedupe existing duplicate rows first (data audit) — reversible migration (drop index) if it blocks legitimate writes.

### `A-WEBHOOK-003` — Stripe webhook signature verification omits the timestamp tolerance / replay window — captured signed events can be replayed indefinitely

- **Severity:** LOW (validated) · **Priority:** P0 · **Effort:** XS · **Domain:** webhook · **Discovered by:** lane-a
- **Component(s):** server/routes/stripe-connect.ts verifyStripeWebhookSignature; server/routes.ts per-HOA inline Stripe verification
- **Recommended owner:** YCM backend eng (auth/webhooks)
- **Dependencies / sequencing:** Same webhook-verification code as A-WEBHOOK-001/002 — bundle into the same PR.
- **Regression risk:** Low — additive check; only rejects stale/clock-skewed deliveries (make tolerance configurable).
- **Required tests:** stale timestamp rejected; fresh timestamp accepted; clock-skew within tolerance accepted
- **Rollback requirements:** Additive check only; revert the tolerance check if it rejects legitimate clock-skewed deliveries (tune tolerance instead of reverting).

---

## Wave 1 — Tests, telemetry, backups, deploy-safety (must precede risky cleanup)

Build the safety net BEFORE Waves 2 and 3 touch the riskiest code. This wave is mostly configuration, process, and test-authoring — not deep code surgery — and several items here are prerequisites for later waves (the tenant-isolation meta-test in CQ-10 must exist before the AUTHZ fixes land; the cross-machine locking must land before any scale-out; the Neon pool sizing must be confirmed before capacity work continues).

**17 finding(s) in this wave.**

### `A-REL-004` — Auto-deploy on every merge with immediate strategy + auto-run schema migrations + no staging and no automated rollback

- **Severity:** HIGH (validated) · **Priority:** P1 · **Effort:** M · **Domain:** reliability · **Discovered by:** lane-a
- **Component(s):** .github/workflows/fly-deploy.yml; fly.toml release_command; scripts/migrate.cjs
- **Recommended owner:** YCM release engineer / DevOps
- **Dependencies / sequencing:** Coordinate with CQ-005 (same root gap) — ship as one deploy-safety change set.
- **Regression risk:** Medium — changing deploy strategy on a single-machine app needs care (rolling needs ≥2 machines); a migration-review gate adds process friction.
- **Required tests:** dry-run a deliberately-failing migration and confirm deploy aborts with app machines unchanged; verify documented restore-from-backup path against a staging DB
- **Rollback requirements:** New deploy strategy (rolling/health-gated) is a Fly config change — revert to `immediate` strategy in fly.toml if rollout issues appear on the single-machine topology.

### `CQ-001` — ESLint scope is client-only — entire server/ (38.5k lines, all money/tenant/webhook logic) is never linted

- **Severity:** HIGH (validated) · **Priority:** P1 · **Effort:** M · **Domain:** CI quality gates / static analysis · **Discovered by:** lane-c
- **Component(s):** package.json; server/**
- **Recommended owner:** YCM backend eng (lead) + whole team (incremental triage)
- **Dependencies / sequencing:** SEVERITY RESOLVED TO HIGH (see report §Severity Resolutions) — supersedes A-REL-006's LOW rating on the same fact.
- **Regression risk:** Low (adding lint coverage; enabling rules incrementally avoids a merge wall).
- **Required tests:** None specified
- **Rollback requirements:** Lint-only change — reverting the script line removes the gate; no functional risk. Expect a large initial finding backlog — triage incrementally, do not bulk-suppress.

### `CQ-003` — npm-audit CI gate fails on CRITICAL CVEs only — high/moderate vulns merge freely

- **Severity:** HIGH (validated) · **Priority:** P1 · **Effort:** S · **Domain:** CI quality gates / supply chain · **Discovered by:** lane-c
- **Component(s):** .github/workflows/security.yml
- **Recommended owner:** YCM DevOps / backend eng (triage)
- **Dependencies / sequencing:** One-time triage of current high/moderate CVEs required BEFORE flipping the gate, or the first PR after the change will be blocked.
- **Regression risk:** Low-medium (may block merges until existing high CVEs are resolved/allowlisted — do a one-time triage first).
- **Required tests:** None specified
- **Rollback requirements:** Workflow threshold change (`--audit-level=high`) — revert the flag if it blocks merges on an unresolvable transitive CVE (add to the allowlist instead).

### `CQ-004` — Single self-hosted macOS runner is the sole CI + deploy host — SPOF observed offline blocking all CI

- **Severity:** HIGH (validated) · **Priority:** P1 · **Effort:** M · **Domain:** CI quality gates / availability · **Discovered by:** lane-c
- **Component(s):** .github/workflows/ci.yml; .github/workflows/fly-deploy.yml
- **Recommended owner:** YCM DevOps
- **Dependencies / sequencing:** mini-ycm runner reportedly already exists per founder-os#10197 — confirm and register it, or arm hosted-fallback.
- **Regression risk:** Low (adding redundancy).
- **Required tests:** None specified
- **Rollback requirements:** Adding a second self-hosted runner (or arming the OP #83 hosted-fallback) is additive — no rollback risk.

### `CQ-005` — Every push to main auto-deploys to prod with no staging/promotion gate in the pipeline

- **Severity:** HIGH (validated) · **Priority:** P1 · **Effort:** M · **Domain:** CI quality gates / release safety · **Discovered by:** lane-c
- **Component(s):** .github/workflows/fly-deploy.yml
- **Recommended owner:** YCM release engineer / DevOps
- **Dependencies / sequencing:** Same root gap as A-REL-004 — the yourcondomanager-staging app referenced in the finding needs confirming/provisioning first.
- **Regression risk:** Low (adds a gate; existing OP #31 'deploy-on-merge' intent can be preserved via auto-promote-after-staging-green).
- **Required tests:** post-deploy smoke test as the promotion gate
- **Rollback requirements:** Environment-protection rule / promotion gate is additive to the workflow — remove the gate to revert.

### `PERF-B-002` — Postgres pool has no max configured → pg default of 10 connections caps throughput under the automation sweep

- **Severity:** HIGH (validated) · **Priority:** P1 · **Effort:** S · **Domain:** performance/db-connection-pooling · **Discovered by:** lane-b
- **Component(s):** server/db.ts; server/index.ts (automation sweep)
- **Recommended owner:** YCM backend eng / DevOps
- **Dependencies / sequencing:** Confirm Neon plan's max_connections before setting the pool max — do not guess a value.
- **Regression risk:** low — additive config; wrong (too-high) value could hit Neon's ceiling, so verify against the plan limit.
- **Required tests:** load test at expected concurrency observing pool wait time; confirm Neon max_connections for the current plan
- **Rollback requirements:** Config-only (`max` on the pool) — revert by removing the value; tune against Neon's actual connection ceiling first.

### `SCALE-B-003` — Six in-process setInterval schedulers + the automation sweep are guarded only by in-memory state → duplicate money actions on any multi-machine scale-out

- **Severity:** HIGH (validated) · **Priority:** P1 · **Effort:** M · **Domain:** scalability/single-machine-state · **Discovered by:** lane-b
- **Component(s):** server/index.ts; server/rate-limit.ts; server/vendor-compliance-scheduler.ts; server/de-provisioning.ts; server/election-scheduler.ts; server/routes.ts; fly.toml
- **Recommended owner:** YCM backend eng
- **Dependencies / sequencing:** Must land BEFORE any multi-machine scale-out is enabled on Fly — currently safe only because min_machines_running=1.
- **Regression risk:** medium — an advisory lock that isn't released on crash could stall a sweep; use a session-scoped lock that auto-releases on disconnect.
- **Required tests:** two-instance test proving only one sweep runs; crash-mid-sweep releases the lock
- **Rollback requirements:** Same as A-REL-005.

### `A-OPS-003` — Error tracking (Sentry) wired in code but inert in production — SDKs not installed, DSNs empty

- **Severity:** MEDIUM (validated) · **Priority:** P1 · **Effort:** S · **Domain:** ops · **Discovered by:** lane-a
- **Component(s):** server/observability.ts; client/src/lib/observability.ts; fly.toml build args; package.json
- **Recommended owner:** YCM backend eng / DevOps
- **Dependencies / sequencing:** Ships together with CQ-009 (same finding, two lanes).
- **Regression risk:** Low — enabling is additive; init is idempotent and no-ops safely if misconfigured.
- **Required tests:** trigger a server error and confirm a Sentry event; confirm client error boundary reports to Sentry
- **Rollback requirements:** Additive (SDK install + Fly secret) — Sentry no-ops safely if misconfigured; no functional rollback risk.

### `A-REL-005` — In-process interval schedulers run per-machine without cross-machine locking; can double-fire side effects during multi-machine windows

- **Severity:** MEDIUM (needs runtime verification) · **Priority:** P1 · **Effort:** S · **Domain:** reliability · **Discovered by:** lane-a
- **Component(s):** server/election-scheduler.ts; server/de-provisioning.ts; server/vendor-compliance-scheduler.ts; server/index.ts automation sweep
- **Recommended owner:** YCM backend eng
- **Dependencies / sequencing:** Ships together with SCALE-B-003 (same root cause) — reuse the existing bank-feed-sync.ts pg_try_advisory_lock pattern.
- **Regression risk:** Low — advisory-lock wrap is additive; on a single machine it always acquires the lock and behavior is unchanged.
- **Required tests:** simulate two concurrent sweep invocations and assert only one performs side effects; assert de-provisioning does not send duplicate deactivation emails under concurrent runs
- **Rollback requirements:** Additive advisory-lock wrapper — on the current single-machine topology the lock always acquires immediately, so behavior is unchanged; revert by removing the wrapper.

### `A-SEC-002` — Google Maps API key committed to source (fly.toml build arg + docs)

- **Severity:** MEDIUM (validated) · **Priority:** P1 · **Effort:** S · **Domain:** secrets · **Discovered by:** lane-a
- **Component(s):** fly.toml build args; INSTALL-OBSERVABILITY.md
- **Recommended owner:** YCM DevOps + William (GCP console access)
- **Dependencies / sequencing:** Ships together with COST-B-004 and CQ-012 (same finding, 3 lanes) — one fix closes all three.
- **Regression risk:** Low — key rotation + build-arg injection is transparent to runtime if restrictions match the serving domain.
- **Required tests:** verify Maps still loads on the production domain after restriction+rotation; confirm the key is rejected from an unauthorized referrer
- **Rollback requirements:** Key rotation + restriction is a config change; revert by re-issuing an unrestricted key (not recommended) if the restricted key breaks Maps rendering on an unanticipated origin.

### `COST-B-004` — Google Maps API key committed in fly.toml — cost/quota-theft exposure if the key is not usage-restricted

- **Severity:** MEDIUM (needs runtime verification) · **Priority:** P1 · **Effort:** S · **Domain:** cost/external-service · **Discovered by:** lane-b
- **Component(s):** fly.toml
- **Recommended owner:** YCM DevOps + William (GCP console access)
- **Dependencies / sequencing:** Duplicate of A-SEC-002 / CQ-012 — one fix closes all three.
- **Regression risk:** low — referrer restriction can break local/preview origins if too narrow; include dev origins.
- **Required tests:** confirm map still renders from the prod origin after restriction; confirm a non-allowed origin is rejected
- **Rollback requirements:** Same as A-SEC-002.

### `CQ-006` — Playwright (incl. visual-regression + axe a11y) is a NON-required check — PRs can merge with it red

- **Severity:** MEDIUM (validated) · **Priority:** P1 · **Effort:** S · **Domain:** test coverage / quality gate · **Discovered by:** lane-c
- **Component(s):** branch protection; ci.yml Playwright job
- **Recommended owner:** YCM QA / release engineer
- **Dependencies / sequencing:** Requires the Playwright suite to be de-flaked first (browser-cache hardening, founder-os#10172) or merges will be blocked by flaky tests.
- **Regression risk:** Low-medium (requiring a flaky check would block merges — hence stabilize/split first).
- **Required tests:** None specified
- **Rollback requirements:** Branch-protection required-checks change — remove the requirement to revert. Promote incrementally (route-mock + a11y first; visual-regression stays advisory until flake is fixed per founder-os#10172).

### `CQ-009` — Server error reporting is conditional on SENTRY_DSN and silently no-ops when unset

- **Severity:** MEDIUM (needs runtime verification) · **Priority:** P1 · **Effort:** S · **Domain:** observability / error-handling · **Discovered by:** lane-c
- **Component(s):** server/observability.ts
- **Recommended owner:** YCM backend eng / DevOps
- **Dependencies / sequencing:** Duplicate of A-OPS-003 — one PR closes both.
- **Regression risk:** Low.
- **Required tests:** boot-time config assertion test for prod env
- **Rollback requirements:** Same as A-OPS-003.

### `CQ-010` — No systematic per-call-site tenant-isolation test coverage across ~515 routes

- **Severity:** MEDIUM (candidate) · **Priority:** P1 · **Effort:** M · **Domain:** test coverage · **Discovered by:** lane-c
- **Component(s):** server/routes.ts; tests/
- **Recommended owner:** YCM backend eng (security/tenant) + QA
- **Dependencies / sequencing:** Build the route-inventory meta-test BEFORE the Wave 2 tenant-isolation fixes land, so each fix has a regression test ready and future routes are covered automatically.
- **Regression risk:** Low (adding tests).
- **Required tests:** route-inventory tenant-scope coverage meta-test; assertResourceScope unresolved-association regression test
- **Rollback requirements:** New tests only — zero rollback risk.

### `CQ-012` — Google Maps API key committed in fly.toml (version control + git history)

- **Severity:** MEDIUM (validated) · **Priority:** P1 · **Effort:** S · **Domain:** product hygiene / secrets · **Discovered by:** lane-c
- **Component(s):** fly.toml
- **Recommended owner:** YCM DevOps + William (GCP console access)
- **Dependencies / sequencing:** Duplicate of A-SEC-002 / COST-B-004 — one fix closes all three.
- **Regression risk:** Low (rotation + restriction).
- **Required tests:** None specified
- **Rollback requirements:** Same as A-SEC-002.

### `A-REL-006` — ESLint scoped to client only — entire server/ (money handlers) is unlinted

- **Severity:** LOW (validated) · **Priority:** P1 · **Effort:** M · **Domain:** reliability · **Discovered by:** lane-a
- **Component(s):** package.json lint script; server/*
- **Recommended owner:** YCM backend eng (lead) + whole team (incremental triage)
- **Dependencies / sequencing:** Duplicate of CQ-001 — same fix, one PR. Severity resolved to HIGH per CQ-001 (see report).
- **Regression risk:** Low at config level; the first server lint run will surface a backlog that should be addressed gradually, not block-all at once.
- **Required tests:** confirm `eslint server` runs in CI and fails on an introduced floating-promise
- **Rollback requirements:** Same as CQ-001.

### `STARTUP-B-006` — Database seeding runs on every process boot (await seedDatabase) — boot latency + correctness risk if the seed is not fully idempotent

- **Severity:** LOW (needs runtime verification) · **Priority:** P2 · **Effort:** S · **Domain:** performance/build-startup · **Discovered by:** lane-b
- **Component(s):** server/index.ts; server/seed.ts
- **Recommended owner:** YCM backend eng
- **Dependencies / sequencing:** Verify seed.ts idempotency (4257 lines) before fully disabling on prod boot — do a partial read-through first.
- **Regression risk:** low — flag-gating is additive; ensure prod still has its required reference rows via migration.
- **Required tests:** boot with seed disabled still serves; re-running seed twice is a no-op (row counts stable)
- **Rollback requirements:** Flag-gate is additive — default the flag to current (seed-on-boot) behavior until verified safe to disable in prod.

---

## Wave 2 — High-impact security / reliability / performance

The real engineering lift. **Must be substantially complete before (a) a second tenant/HOA is onboarded and (b) the GL/amenity-money-loop feature flags are flipped on for any association** — those two triggers convert several of these findings from bounded, latent design defects into live cross-tenant breaches or live double-charge/double-posting bugs.

**20 finding(s) in this wave.**

### `A-AUTH-001` — Owner/board portal bearer (x-portal-access-id) is a permanent, non-rotating, non-revocable DB primary key

- **Severity:** HIGH (validated) · **Priority:** P1 · **Effort:** XL · **Domain:** portal · **Discovered by:** lane-a
- **Component(s):** requirePortal middleware; portal OTP verify; resolvePortalAccessContext; uploads-access; portal_access schema
- **Recommended owner:** YCM backend eng (auth/portal) — XL, phase it
- **Dependencies / sequencing:** Highest-effort item in Wave 2 — start design/spec early (Wave 1 timeframe) even though the code lands in Wave 2; needs a client-side (React) change too.
- **Regression risk:** High — this is the core portal auth mechanism referenced by dozens of routes; changing it touches every portal endpoint and the client. Requires phased migration + token backfill.
- **Required tests:** portal token rotates on re-login and old token is rejected; portal logout invalidates the token server-side; absolute-lifetime cap fires even under continuous use; leaked/rotated id no longer resolves
- **Rollback requirements:** High regression risk (core portal auth, touches dozens of routes + the client) — phased migration with a backfill/dual-read period; old header path should be dual-supported during rollout, not hard-cut.

### `A-AUTHZ-001` — assertResourceScope fails OPEN when the resource's association is unresolved (null/undefined) — cross-tenant read/write of null-association resources across 9 resource types

- **Severity:** HIGH (validated) · **Priority:** P1 · **Effort:** M · **Domain:** authz/tenant-isolation · **Discovered by:** lane-a
- **Component(s):** server/routes.ts:assertResourceScope; server/storage.ts:getAssociationIdForScopedResource; governance-templates; clause-records; notice-templates; notice-sends; communication-history; ai-ingestion-job
- **Recommended owner:** YCM backend eng (tenant/security)
- **Dependencies / sequencing:** Fix mirrors the ALREADY-hardened assertAssociationScope pattern in the same file — low design risk, mostly a mechanical parity fix.
- **Regression risk:** Medium — flipping to fail-closed will start rejecting requests that today silently pass on null-association rows or on any not-yet-created id; legitimate flows that read/write genuinely-global templates (state-library/ct-baseline) must be preserved via the explicit allow-list branch, and any handler that calls assertResourceScope before creating a not-yet-existent resource must be reviewed.
- **Required tests:** non-platform admin PATCH/DELETE of a governance template with association_id=NULL is denied; non-platform admin cannot read/mutate a clause-record/notice-template/communication-history row with null association; unknown resourceType passed to assertResourceScope throws rather than allows; platform-admin still allowed on global templates; legitimate same-tenant resource still passes
- **Rollback requirements:** Flipping to fail-closed may reject legitimate global-template reads — needs an explicit allow-list branch for platform-provided templates (state-library/ct-baseline) before/with the fix; revert = restore the fail-open branch.

### `A-AUTHZ-002` — records-requests module: complete absence of tenant isolation — cross-tenant IDOR read+write across all 7 routes (CT §47-260 owner records)

- **Severity:** HIGH (validated) · **Priority:** P0 · **Effort:** M · **Domain:** authz/tenant-isolation · **Discovered by:** lane-a
- **Component(s):** server/routes/records-requests.ts; server/storage.ts:getRecordsRequests/getRecordsRequest/updateRecordsRequest/getRecordsRequestItems
- **Recommended owner:** YCM backend eng (tenant/security) — LEAD ITEM, start immediately in parallel with Wave 0/1
- **Dependencies / sequencing:** Deterministic, confirmed, zero-isolation module (CT §47-260 owner records) — highest-confidence tenant-isolation fix; do not wait for the rest of Wave 2.
- **Regression risk:** Low-to-medium — adding scope checks may 400/403 existing clients that relied on omitting associationId (which currently returns all tenants), so the frontend must always pass a scoped associationId; platform-admin cross-tenant flows must be preserved.
- **Required tests:** tenant A admin GET /api/records-requests/:id of a tenant B request returns 403/404; tenant A admin PATCH of tenant B request denied; GET /api/records-requests without associationId does not return other tenants' rows for a non-platform admin; POST cannot create a request in a non-scoped association; platform-admin retains cross-tenant access
- **Rollback requirements:** Adding scope checks may reject clients that relied on omitting associationId — coordinate a frontend change in the same release; revert is a code revert (re-permits the hole) if it breaks a legitimate flow.

### `A-STRIPE-001` — Amenity deposit forfeit (capture) and refund (cancel) send NO Idempotency-Key, causing money/record desync on retry

- **Severity:** HIGH (validated) · **Priority:** P1 · **Effort:** S · **Domain:** payments/money-integrity · **Discovered by:** lane-a
- **Component(s):** amenity-stripe-gateway; amenity-money-service; amenity-money-loop
- **Recommended owner:** YCM backend eng (payments)
- **Dependencies / sequencing:** Currently latent (GL/amenity flag default-off) — fix BEFORE any association is allowlisted for the amenity money loop.
- **Regression risk:** Low — additive header on money-moving POSTs; must ensure the key encodes the exact operation grain (amount included) so a legitimate distinct forfeit/refund of a different amount is a distinct key.
- **Required tests:** forfeit retry after DB write failure does not double-capture and the column eventually reflects the captured amount; refund retry after cancel does not error-loop and column reflects release; distinct partial forfeits of different amounts produce distinct keys
- **Rollback requirements:** Additive Idempotency-Key header — revert removes the header; must include amount in the key so distinct-amount operations remain distinct.

### `DATA-B-009` — Money-moving multi-row writes are NOT transactional — server uses db.transaction exactly once (a non-money RAG path), so a mid-operation failure leaves partial financial state

- **Severity:** HIGH (validated) · **Priority:** P1 · **Effort:** M · **Domain:** data/transactions-and-integrity · **Discovered by:** lane-b (verification pass, worker on #10579)
- **Component(s):** owner-ledger import; owner-ledger entry posting; reconciliation apply; autopay sweep
- **Recommended owner:** YCM backend eng (money/ledger)
- **Dependencies / sequencing:** Build a shared postToLedger(tx) helper so new money-write call sites inherit atomicity automatically — do this before/alongside A-STRIPE-002 (same non-atomic-writes root cause).
- **Regression risk:** low-medium — wrapping sequential writes in a transaction changes failure semantics to all-or-nothing (the intent); must confirm no long-running import loop holds a tx open past Neon statement/idle timeout (batch large imports).
- **Required tests:** fault-injection: fail mid bank-statement import, assert zero partial ledger rows (rollback); re-run idempotency still holds after a rolled-back import
- **Rollback requirements:** Wrapping sequential writes in a transaction changes failure semantics to all-or-nothing (the intended fix) — must confirm no long-running import loop holds a transaction open past Neon's statement/idle timeout (batch large imports); revert by removing the transaction wrapper.

### `A-AUTHZ-003` — amenities module: list endpoint trusts raw client associationId and by-id write/read endpoints have no association check — cross-tenant IDOR (amenities + owner reservations)

- **Severity:** MEDIUM (validated) · **Priority:** P2 · **Effort:** S · **Domain:** authz/tenant-isolation · **Discovered by:** lane-a
- **Component(s):** server/routes/amenities.ts; amenities table; amenityReservations table
- **Recommended owner:** YCM backend eng (tenant/security)
- **Dependencies / sequencing:** Bundle with A-AUTHZ-001/002 — same PR family, same test harness (CQ-010's meta-test).
- **Regression risk:** Low — the frontend already passes associationId on list; adding validation only rejects out-of-scope values. By-id checks add a single membership assertion per handler.
- **Required tests:** tenant A admin GET /api/amenities?associationId=<tenantB> returns 403; tenant A admin PATCH/DELETE /api/amenities/:id of a tenant B amenity denied; tenant A admin cannot read tenant B amenity reservations; platform-admin retains cross-tenant access
- **Rollback requirements:** Additive validation on an existing endpoint — revert removes the check.

### `A-AUTHZ-004` — Systemic inconsistency: newer server/routes/*.ts modules hand-roll Drizzle queries and bypass the central tenant-isolation guards, applying isolation unevenly

- **Severity:** MEDIUM (validated) · **Priority:** P2 · **Effort:** L · **Domain:** authz/tenant-isolation · **Discovered by:** lane-a
- **Component(s):** server/routes/*.ts; server/routes.ts (central guards)
- **Recommended owner:** YCM backend eng (tenant/security) — architectural follow-through
- **Dependencies / sequencing:** This is the ROOT-CAUSE fix for A-AUTHZ-001/002/003 recurring — do LAST in the AUTHZ cluster once the concrete instances are fixed, so the new primitive is shaped by real cases.
- **Regression risk:** Low as a policy/refactor if introduced additively; each converted module needs the same tenant-scope tests.
- **Required tests:** a cross-tenant IDOR test harness applied to every server/routes/*.ts module; CI check that flags a route handler doing db.select/update by id with no association assertion
- **Rollback requirements:** Introducing a shared mandatory scope primitive is additive; existing call sites keep working until migrated module-by-module.

### `A-LEDGER-005` — Money amounts stored as single-precision float (real/float4) in owner_ledger_entries and payment_webhook_events — precision loss and off-by-a-cent risk on large amounts and float summation

- **Severity:** MEDIUM (validated) · **Priority:** P2 · **Effort:** L · **Domain:** ledger · **Discovered by:** lane-a
- **Component(s):** shared/schema.ts owner_ledger_entries.amount; shared/schema.ts payment_webhook_events.amount; server/services/reconciliation/report.ts; server/services/plaid-reconciliation.ts match math
- **Recommended owner:** YCM backend eng (money/ledger) — data migration
- **Dependencies / sequencing:** Consider sequencing the interim float8 change early (cheap) and the full integer-cents end-to-end migration as a Wave 3 architecture-adjacent project.
- **Regression risk:** Medium — a column-type migration touches every ledger reader/writer and requires careful data conversion; interim float8 change is lower risk.
- **Required tests:** large-amount round-trip preserves cents; aggregate of many entries ties to sum of integer cents; reconciliation variance stays 0 across the change
- **Rollback requirements:** Column-type migration touches every ledger reader/writer — do the float8 interim step first (lower risk), full integer-cents migration is a larger follow-on; revert requires re-migrating the column type back (higher-risk direction, plan carefully).

### `A-RECON-004` — Bank credits are never marked consumed (reconciledToPaymentTransactionId is written nowhere) — across sync runs one bank deposit can settle multiple same-amount ledger entries

- **Severity:** MEDIUM (validated) · **Priority:** P2 · **Effort:** S · **Domain:** reconciliation · **Discovered by:** lane-a
- **Component(s):** server/services/plaid-reconciliation.ts reconcileBankTransactions/applyMatch; shared/schema.ts owner_ledger_entries.bankTransactionId / bank_transactions.reconciledToPaymentTransactionId
- **Recommended owner:** YCM backend eng (money/ledger)
- **Dependencies / sequencing:** Latent (only the default-off Plaid-pay-intent path uses this matcher today) — fix before/with A-LEDGER-007.
- **Regression risk:** Low-medium — the report already derives matched state from the ledger side, so writing the bank-side marker is additive; must ensure the field semantics (payment_transaction vs ledger entry) don't collide with any other reconciliation lane.
- **Required tests:** credit consumed once → excluded from next run; two equal-amount pending entries + one credit → only one settled; applyMatch atomicity under failure
- **Rollback requirements:** Additive column write inside the existing match transaction — revert by not writing the marker (returns to current behavior).

### `A-RECON-006` — charge.refunded / dispute.created / dispute.closed webhooks are only acknowledged — they never reverse the owner-ledger payment entry, so refunded/charged-back payments leave the owner balance artificially reduced

- **Severity:** MEDIUM (validated) · **Priority:** P2 · **Effort:** M · **Domain:** reconciliation/ledger · **Discovered by:** lane-a
- **Component(s):** server/routes/stripe-connect.ts platform Connect webhook switch
- **Recommended owner:** YCM backend eng (money/ledger)
- **Dependencies / sequencing:** Reuse the canonical payment-identity idempotency key from the A-WEBHOOK-001 fix to avoid double-reversal — sequence after Wave 0.
- **Regression risk:** Low-medium — additive write; must be idempotent and must handle partial refunds (refund amount vs original charge amount).
- **Required tests:** full refund posts one reversing entry; partial refund posts partial reversal; duplicate refund webhook is idempotent; dispute lost posts reversal + fee
- **Rollback requirements:** New reversing-entry write path — must be idempotent and handle partial refunds; revert by returning to acknowledge-only (re-opens the gap).

### `A-STRIPE-002` — Non-transactional charge-then-column-write in the amenity money loop with no Stripe-truth reconciler

- **Severity:** MEDIUM (validated) · **Priority:** P1 · **Effort:** M · **Domain:** payments/money-integrity · **Discovered by:** lane-a
- **Component(s):** amenity-money-service; amenity-stripe-gateway; amenities-routes
- **Recommended owner:** YCM backend eng (payments)
- **Dependencies / sequencing:** Latent (same GL/amenity gate) — fix before flipping the flag; persist the Stripe intent id (shares work with A-STRIPE-003).
- **Regression risk:** Medium — introduces a reconciliation path over money columns; must be idempotent and read-only against the ledger of record.
- **Required tests:** simulate DB write failure after Stripe success and assert reconciler repairs the column; assert repair never double-writes when column already correct
- **Rollback requirements:** Adding a reconciler is additive/read-only against Stripe; must be idempotent — revert by disabling the reconciler job.

### `A-STRIPE-003` — Deposit-hold lookup relies on eventually-consistent Stripe Search instead of a stored intent id

- **Severity:** MEDIUM (validated) · **Priority:** P2 · **Effort:** S · **Domain:** payments/money-integrity · **Discovered by:** lane-a
- **Component(s):** amenity-stripe-gateway
- **Recommended owner:** YCM backend eng (payments)
- **Dependencies / sequencing:** Shares the persisted-intent-id work with A-STRIPE-002 — do together.
- **Regression risk:** Low-medium — adds a column + write; direct-id lookup is more robust than search.
- **Required tests:** hold then immediately forfeit resolves via stored id without relying on search; search fallback still works when id is absent
- **Rollback requirements:** New nullable column + direct-id lookup, Search kept as fallback — low risk, additive.

### `CQ-008` — Stripe money calls use 6+ hand-rolled raw fetch() to api.stripe.com (no SDK) — repeated fragile abstraction

- **Severity:** MEDIUM (validated) · **Priority:** P2 · **Effort:** L · **Domain:** repeated code / fragile abstractions · **Discovered by:** lane-c
- **Component(s):** server/routes.ts; server/storage.ts; server/services/payment-service.ts; server/services/stripe-connect.ts
- **Recommended owner:** YCM backend eng (payments) — refactor
- **Dependencies / sequencing:** Natural container for A-STRIPE-001/004's idempotency fixes — build the shared stripeFetch() wrapper as part of this work, then land the individual idempotency fixes through it.
- **Regression risk:** Medium (touching money call-sites — do behind tests + TEST-mode verification).
- **Required tests:** idempotency-key presence test per money mutation; retry/timeout behavior test on the wrapper
- **Rollback requirements:** New shared client wraps the 6 existing raw-fetch sites one at a time behind tests — revert per-site if a migration regresses a call.

### `A-AUTH-002` — Portal + vendor-portal OTP codes generated with Math.random() (non-CSPRNG, CWE-338)

- **Severity:** LOW (validated) · **Priority:** P3 · **Effort:** XS · **Domain:** portal · **Discovered by:** lane-a
- **Component(s):** portal OTP request; vendor-portal OTP request
- **Recommended owner:** YCM backend eng (auth/portal)
- **Dependencies / sequencing:** No dependency — can ship any time, bundling into the portal-auth PR for review efficiency.
- **Regression risk:** Very low — one-line generator swap; output shape (6-digit string) unchanged.
- **Required tests:** OTP still 6 digits; OTP generated via crypto CSPRNG (no Math.random)
- **Rollback requirements:** One-line generator swap, output shape unchanged — trivially revertible.

### `A-AUTH-003` — Admin session cookie scoped to parent domain (.yourcondomanager.org) — readable by every subdomain

- **Severity:** LOW (validated) · **Priority:** P3 · **Effort:** S · **Domain:** session · **Discovered by:** lane-a
- **Component(s):** express-session cookie config; session-cookie-domain resolver
- **Recommended owner:** YCM backend eng (auth/portal) + product sign-off
- **Dependencies / sequencing:** Requires a subdomain inventory pass first; do not narrow scope blind.
- **Regression risk:** Medium — reverting to host-only breaks the documented apex↔app login persistence; needs product sign-off.
- **Required tests:** cookie domain scope matches intended subdomain set; no untrusted subdomain receives the sid cookie
- **Rollback requirements:** Needs a subdomain inventory + product sign-off before narrowing cookie scope (breaks documented cross-host SSO if done carelessly) — revert to parent-domain scope if SSO breaks.

### `A-AUTH-004` — Admin association scopes silently auto-hydrate (read-write) from portal_access rows by email

- **Severity:** LOW (candidate) · **Priority:** P3 · **Effort:** M · **Domain:** auth · **Discovered by:** lane-a
- **Component(s):** applyAdminContext / requireAdmin scope resolution
- **Recommended owner:** YCM backend eng (auth)
- **Dependencies / sequencing:** Data-audit prerequisite — 'candidate' confidence; do the audit as the first step of this item.
- **Regression risk:** Medium — some admins may rely on auto-hydrated scopes; needs a data audit before tightening.
- **Required tests:** admin scope is not silently widened by a new portal_access row; auto-hydrate (if kept) grants least privilege and is audit-logged
- **Rollback requirements:** Needs the data-audit noted in the finding (can portal_access rows be attacker-influenced for an admin's email) before deciding read-only-vs-approval-step remediation.

### `A-AUTH-005` — Inconsistent portal session-expiry enforcement: uploads path checks status only, not 30-day inactivity

- **Severity:** LOW (validated) · **Priority:** P3 · **Effort:** S · **Domain:** portal · **Discovered by:** lane-a
- **Component(s):** authorizeUploadAccess portal path; resolvePortalAccessContext
- **Recommended owner:** YCM backend eng (auth/portal)
- **Dependencies / sequencing:** Cheap, bundle into the A-AUTH-001 portal-auth rework so both ship in the same review.
- **Regression risk:** Low — additive stricter check on an existing deny path.
- **Required tests:** idle-expired active portal id is denied file access just like normal portal routes
- **Rollback requirements:** Additive stricter check on an existing deny path — revert removes the idle check on the uploads route.

### `A-LEDGER-007` — Portal Plaid pay posts a balance-reducing ledger entry with no settlement and no idempotency (referenceId = bank connection id) — gated OFF by default, but a balance-without-money-movement risk if enabled

- **Severity:** LOW (candidate) · **Priority:** P3 · **Effort:** M · **Domain:** ledger · **Discovered by:** lane-a
- **Component(s):** server/routes.ts POST /api/portal/plaid/pay; server/services/bank-feed/plaid-env-guard.ts isPortalPlaidPayEnabled
- **Recommended owner:** YCM backend eng (money/ledger)
- **Dependencies / sequencing:** Do NOT enable PORTAL_PLAID_PAY_ENABLED until this AND A-RECON-004 are both fixed — sequence together.
- **Regression risk:** Low while gated off; the fix is part of building the settlement path.
- **Required tests:** flag off → 503; no duplicate ledger entry per confirmed payment; balance reduces only on confirmed settlement
- **Rollback requirements:** Currently gated OFF (503) — no live risk; fix is part of building the real settlement path, not a standalone patch.

### `A-STRIPE-004` — Platform subscription-billing Stripe passthrough has no idempotency support and no transient-error retry

- **Severity:** LOW (validated) · **Priority:** P2 · **Effort:** S · **Domain:** payments/money-integrity · **Discovered by:** lane-a
- **Component(s):** stripeRequest-passthrough; platform-billing; signup-checkout
- **Recommended owner:** YCM backend eng (payments)
- **Dependencies / sequencing:** Lower exposure (platform-admin-gated route) — bundle with CQ-008's shared Stripe client work.
- **Regression risk:** Low — additive; keys must be stable per logical operation.
- **Required tests:** subscription create retry does not produce a second Stripe subscription; customer create retry reuses the customer
- **Rollback requirements:** Additive idempotency support on the platform-billing passthrough — revert removes the key parameter.

### `A-STRIPE-005` — refundKey collapses two distinct same-amount partial refunds of one charge within Stripe's 24h idempotency window

- **Severity:** LOW (candidate) · **Priority:** P3 · **Effort:** XS · **Domain:** payments/money-integrity · **Discovered by:** lane-a
- **Component(s):** stripe-idempotency; refund-service
- **Recommended owner:** YCM backend eng (payments)
- **Dependencies / sequencing:** Confirm with product/finance whether two equal-amount partial refunds in 24h is a real scenario before prioritizing (flagged 'candidate' by lane-a).
- **Regression risk:** Low — key-grain change; must preserve retry-collapse for genuine retries.
- **Required tests:** two distinct $X refunds on the same charge both succeed; a true network retry of one refund still collapses
- **Rollback requirements:** Key-grain change on refunds — revert to the old key if the disambiguator breaks retry-collapse; verify via the two required tests before shipping.

---

## Wave 3 — Architecture / maintainability / dependencies

Ongoing, incremental, background work. Sequence AFTER Wave 1's regression-test harness exists so decomposition of the monolith files can't silently reopen a tenant-isolation hole. No big-bang rewrite — move-only extraction commits with a route-inventory diff as the safety net per PR.

**4 finding(s) in this wave.**

### `ARCH-B-001` — Two 18-20k-line God-file monoliths (routes.ts, storage.ts) concentrate the whole server surface

- **Severity:** HIGH (validated) · **Priority:** P2 · **Effort:** XL · **Domain:** architecture/module-boundaries · **Discovered by:** lane-b
- **Component(s):** server/routes.ts; server/storage.ts
- **Recommended owner:** YCM backend eng (lead) — ongoing, incremental
- **Dependencies / sequencing:** The substrate under root causes #1 and #3 (see report) — sequence AFTER Wave 1's CQ-010 meta-test and Wave 2's concrete AUTHZ fixes exist, so decomposition doesn't reopen tenant-isolation regressions.
- **Regression risk:** medium — mechanical extraction can drop a route registration or middleware order; mitigated by move-only commits + route-inventory diff.
- **Required tests:** route-inventory snapshot (count + paths) before/after each extraction; existing integration suite green
- **Rollback requirements:** Move-only extraction commits with a route-inventory diff as the safety net per PR — revert any single extraction PR independently without affecting others.

### `CQ-002` — 20.5k-line routes.ts + 18k-line storage.ts monoliths with 200-315-line handlers

- **Severity:** HIGH (validated) · **Priority:** P2 · **Effort:** XL · **Domain:** complexity & readability · **Discovered by:** lane-c
- **Component(s):** server/routes.ts; server/storage.ts
- **Recommended owner:** YCM backend eng (lead) — ongoing, incremental
- **Dependencies / sequencing:** Duplicate of ARCH-B-001 — one initiative closes both.
- **Regression risk:** Medium (moving handlers risks middleware-order or path drift; do per-domain PRs with route-inventory diffs).
- **Required tests:** route-inventory snapshot test (assert the full path list is unchanged after each split)
- **Rollback requirements:** Same as ARCH-B-001 — duplicate finding (lane-b + lane-c, same root fact).

### `CQ-007` — Type-safety escape hatches concentrated in the money/tenant-critical files (37 in routes.ts, 14 in storage.ts)

- **Severity:** MEDIUM (validated) · **Priority:** P3 · **Effort:** L · **Domain:** error-handling & type-safety · **Discovered by:** lane-c
- **Component(s):** server/routes.ts; server/storage.ts
- **Recommended owner:** YCM backend eng (incremental, alongside monolith decomposition)
- **Dependencies / sequencing:** Natural to fix each `as any` site AS you touch it during the ARCH-B-001/CQ-002 decomposition — don't do as a separate blitz.
- **Regression risk:** Low per-site (typing fixes); collectively M.
- **Required tests:** None specified
- **Rollback requirements:** Per-site typing fixes — low individual risk; revert any single site's typing change independently.

### `DB-B-005` — Low explicit-index-to-table ratio (47 indexes / 183 tables) suggests missing composite indexes on hot multi-tenant query paths

- **Severity:** MEDIUM (candidate) · **Priority:** P2 · **Effort:** M · **Domain:** data/db-design · **Discovered by:** lane-b
- **Component(s):** shared/schema.ts; server/storage.ts
- **Recommended owner:** YCM backend eng / DBA — verify then fix
- **Dependencies / sequencing:** Needs EXPLAIN/pg_stat_statements against real usage BEFORE landing indexes (currently 'candidate') — do a data-driven pass, not a guess.
- **Regression risk:** low — additive indexes; watch write amplification on very hot insert tables.
- **Required tests:** EXPLAIN before/after on the top-5 filtered queries; pg_stat_statements top-query capture
- **Rollback requirements:** Additive indexes; must watch write-amplification on hot insert tables when adding — revert by dropping the index if writes regress unacceptably.

---

## Wave 4 — Validated stale/dead-code removal

Intentionally thin this round. No dead-code or stale-flag findings were validated in this audit (lane-c explicitly declined to assert unconfirmed dead-code claims). A dedicated dead-code/stale-flag detection pass (dynamic/route/config/flag-use tracing) is recommended as a follow-on audit before this wave can be meaningfully populated.

**1 finding(s) in this wave.**

### `CQ-013` — 29 TODO/FIXME/XXX markers accumulating, concentrated in a few client files

- **Severity:** LOW (validated) · **Priority:** P3 · **Effort:** S · **Domain:** product hygiene / TODO accumulation · **Discovered by:** lane-c
- **Component(s):** client/src/pages/onboarding-invite.tsx; client/src/lib/phone-formatter.ts; client/src/lib/breadcrumb-paths.ts
- **Recommended owner:** YCM backend + frontend eng (bookkeeping pass)
- **Dependencies / sequencing:** No other validated dead/stale-code findings exist this round (lane-c explicitly declined to assert unconfirmed dead-code claims) — a dedicated dynamic/route/flag-use tracing pass is a recommended follow-on audit to populate Wave 4 further.
- **Regression risk:** None (bookkeeping).
- **Required tests:** None specified
- **Rollback requirements:** Zero functional risk — triage markers into tracked issues or resolve; revert is not applicable (documentation-only change).

---

## No action required — confirmed-safe / positive findings

These findings were investigated and found to be correctly handled, or the original hypothesis was refuted with direct evidence. Listed for completeness and audit-trail honesty (per the fact-vs-hypothesis discipline) — no remediation work is required, only the optional hardening noted per item.

**5 finding(s) in this wave.**

### `A-STRIPE-006` — Cleared: generic Stripe passthrough is not a client-controlled price-tampering vector; owner-payment amounts are server-capped

- **Severity:** INFO (validated) · **Priority:** N/A · **Effort:** XS · **Domain:** payments/money-integrity · **Discovered by:** lane-a
- **Component(s):** stripeRequest-passthrough; owner-payment-link-checkout; platform-subscription-create
- **Recommended owner:** N/A — confirmed safe
- **Dependencies / sequencing:** Cleared finding — optional defense-in-depth hardening only (assert amountCents integer bounds server-side).
- **Regression risk:** None (informational).
- **Required tests:** None specified
- **Rollback requirements:** N/A

### `A-TEST-001` — Test-only routes are triple-gated and NOT production-reachable (mapper flag is a false positive)

- **Severity:** INFO (validated) · **Priority:** N/A · **Effort:** XS · **Domain:** auth · **Discovered by:** lane-a
- **Component(s):** test-routes.ts; index.ts registration
- **Recommended owner:** N/A — confirmed safe
- **Dependencies / sequencing:** Cleared finding — optional startup assertion (PLAYWRIGHT_TEST_MODE never set when NODE_ENV=production) as defense against env misconfiguration.
- **Regression risk:** None (no change proposed).
- **Required tests:** None specified
- **Rollback requirements:** N/A

### `CQ-011` — test-routes.ts is correctly DOUBLE-gated and unreachable in production (validated-safe)

- **Severity:** INFO (validated) · **Priority:** N/A · **Effort:** XS · **Domain:** product hygiene / test-routes prod-reachability · **Discovered by:** lane-c
- **Component(s):** server/test-routes.ts; server/index.ts
- **Recommended owner:** N/A — confirmed safe
- **Dependencies / sequencing:** Duplicate of A-TEST-001 (lane-a + lane-c both confirmed test-routes.ts is double-gated and unreachable in prod).
- **Regression risk:** None.
- **Required tests:** invariant test: registerTestRoutes is a no-op under NODE_ENV=production
- **Rollback requirements:** N/A

### `POS-B-007` — POSITIVE / hypothesis-refuted: money-moving Stripe raw-fetch calls DO carry Idempotency-Key (no double-charge gap found)

- **Severity:** INFO (validated) · **Priority:** N/A · **Effort:** XS · **Domain:** integrity/payments · **Discovered by:** lane-b
- **Component(s):** server/services/payment-service.ts; server/services/amenity-stripe-gateway.ts; server/routes.ts (payment-link passthrough)
- **Recommended owner:** N/A — confirmed safe
- **Dependencies / sequencing:** Positive finding — hypothesis refuted. Optional hardening: make the Idempotency-Key non-optional at the fetch-wrapper level (folds naturally into CQ-008's shared-client work).
- **Regression risk:** low
- **Required tests:** retry-returns-same-intent test per money POST
- **Rollback requirements:** N/A

### `POS-B-008` — POSITIVE: bank-feed reconciliation matcher is well-designed (integer cents, confidence-scored, conflict-safe) — risk #8 largely holds up

- **Severity:** INFO (validated) · **Priority:** N/A · **Effort:** S · **Domain:** integrity/reconciliation · **Discovered by:** lane-b
- **Component(s):** server/services/reconciliation/auto-matcher.ts
- **Recommended owner:** N/A — confirmed safe
- **Dependencies / sequencing:** Positive finding — reconciliation matcher design is sound. Minor seam noted (float-dollars vs integer-cents) — folds into A-LEDGER-005's integer-cents migration.
- **Regression risk:** low
- **Required tests:** property test: round-trip dollars↔cents never drifts a penny across the match range
- **Rollback requirements:** N/A

---
