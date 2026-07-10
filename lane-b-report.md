# YCM Codebase Audit — Lane B report (Architecture / Data / Performance / Cost)

- **Dispatch:** founder-os#10579 · **Repo:** williamruiz1/YourCondoManager @ `origin/main` (`bbb49aa`)
- **Date:** 2026-07-10 · **Mode:** read-only, own clean worktree, node_modules symlinked (no install) · **Discovered by:** lane-b (worker-015)
- **Deliverables:** `findings-b.jsonl` (8 findings) + this report. Zero app-code changes.

## Severity counts
| severity | count |
|---|---|
| high | 3 |
| medium | 2 |
| low | 1 |
| informational (positives / hypothesis-refuted) | 2 |
| **total** | **8** |

## Headline (the 3 highs, prioritized per mapper risks #7/#8/#2)
1. **SCALE-B-003 (risk #7):** every scheduler is an in-process `setInterval` and the money-moving automation sweep (autopay/notices/dispatch/bank-feed) is deduped only by an **in-memory** flag. Safe today ONLY because `min_machines_running=1` pins a single machine — the moment a 2nd machine runs (scale-out, or an overlapping rolling deploy), timers double-fire → **double charges / double notices**. Cross-process lock (pg advisory lock) before any scale-out. `M`.
2. **PERF-B-002:** the shared `pg.Pool` sets no `max` → node-postgres defaults to **10 connections** for the whole process, shared by all requests + the heavy 5-min sweep. Against `hard_limit=250` concurrency this is a throughput ceiling → intermittent 10s-timeout 5xx under load. Set an explicit `max` sized to Neon's limit (+ pooler). `S`.
3. **ARCH-B-001:** `routes.ts` (20,566 lines) + `storage.ts` (18,036) = 38.6k lines / 37% of the server in two God-files. This is the substrate under the top mapper risk (#1 tenant-isolation across ~515 routes in one file) and the fleet's own recurring YCM merge collisions. Incremental move-only extraction into per-domain routers/repositories. `XL`.

## Medium / low
- **COST-B-004 (risk #9):** live Google Maps key committed in `fly.toml:32` (`VITE_`, client-exposed). Not a secret leak, but if unrestricted → quota theft on William's billing. Restrict by referrer+API in GCP console + rotate. `S`. *(restriction status needs console access to confirm.)*
- **DB-B-005:** 47 `index()` defs / 183 tables (~0.26/table) → likely missing composite indexes on hot `association_id+status+date` paths. **Candidate** — needs EXPLAIN/pg_stat_statements to promote to validated. `M`.
- **STARTUP-B-006:** `await seedDatabase()` on every boot (index.ts:564; seed.ts 4257 lines) → cold-start latency after Fly auto_stop + data-integrity risk if any seed write isn't idempotent. Flag-gate seeding off the prod boot path. `S`.

## Positives / hypotheses REFUTED (honest fact-vs-hypothesis, per dispatch)
- **POS-B-007 (risk #2 — largely refuted):** the raw-fetch (no-SDK) **money-moving** Stripe POSTs all carry `Idempotency-Key` — checkout (payment-service:198 + routes:6222 passthrough), off-session payment_intents (payment-service:653), amenity gateway (:90). No double-charge-on-retry gap found. Residual: idempotency is per-call-site *convention* (`if (idempotencyKey)`), not enforced by a shared client — one future call site could omit it. `XS` to harden.
- **POS-B-008 (risk #8 — holds up):** the bank-feed reconciliation matcher does money math in **integer cents**, scores matches 0..1, auto-applies only above `0.85`, surfaces borderline to admins, and has a multi-match conflict rule. Correctness posture is sound. Minor: ledger stores float-dollars (`entry.amount`) vs bank integer `amountCents` — two representations, one conversion seam.

## Areas inspected (this lane)
- Module boundaries / file-size concentration (routes.ts, storage.ts, server/*).
- DB connection pooling (db.ts) + pool sizing vs concurrency (fly.toml, index.ts rate limiters).
- In-process scheduling / background sweep / single-machine in-mem state (index.ts, rate-limit.ts, 4 other schedulers, fly.toml scale config).
- Stripe raw-fetch money calls + idempotency (payment-service.ts, amenity-stripe-gateway.ts, routes.ts passthrough) — risk #2.
- Reconciliation correctness + money math (auto-matcher.ts) — risk #8.
- DB index coverage ratio (schema.ts) + startup/seed path (index.ts, seed.ts).
- External-service cost surface (Maps key, Stripe call sites).

## Areas NOT inspected / out of budget (hand-off to other lanes or runtime)
- **Static circular-dependency graph** (no `madge`/graph tool — read-only, no install). Coupling asserted from concentration, not a proven cycle list.
- **Live query plans / N+1 confirmation** — storage.ts loops sampled were file-parsing (XLSX/CSV), not confirmed DB N+1; needs pg_stat_statements/EXPLAIN (no prod access).
- **Tenant-isolation per-call-site** across the 515 routes (risk #1) — that is the security lane's job; ARCH-B-001 only flags the structural difficulty.
- **Webhook replay/ordering, Plaid verify, portal bearer/OTP** (risks #3/#4) — other lanes.
- **Reconciliation posting side end-to-end** (only the matcher thresholds + a sample of money-math sites read, not all 1272 lines).
- Seed idempotency line-by-line (4257 lines — proportional budget).

## Uncertainty / limitations
- No runtime, no prod DB, no GCP/Stripe console — so DB-B-005, COST-B-004, STARTUP-B-006 are marked `candidate` / `needs runtime verification` and must be confirmed with EXPLAIN / console before remediation. The 3 highs and both positives are `validated` from source read directly in a clean worktree.
- Findings favor fewer, well-supported items (per dispatch) over scanner-volume; every finding quotes code+line.

## Suggested sequencing
`PERF-B-002` (S, quick win) → `SCALE-B-003` (M, before ANY scale-out — highest real-money blast radius) → `COST-B-004` (S, cost meter) → `DB-B-005`/`STARTUP-B-006` (verify-then-fix) → `ARCH-B-001` (XL, incremental, ongoing).
