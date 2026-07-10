# YCM Audit — Lane C: Code Quality / Testing / Product Hygiene

**Repo:** williamruiz1/YourCondoManager @ `origin/main` HEAD `1e6f941`
**Date:** 2026-07-10 · **Auditor:** lane-c (fleet) · **Mode:** read-only, clean worktree, no install, no app-code changes
**Dispatch:** founder-os#10580 · **Prioritized risks:** #10 (secrets/CI/eslint), #6 (staging/deploy/Sentry)

## Severity counts (13 findings)
| Severity | Count | IDs |
|---|---|---|
| high | 5 | CQ-001 (eslint client-only), CQ-002 (monoliths), CQ-003 (CVE gate critical-only), CQ-004 (single-runner SPOF), CQ-005 (auto-deploy no gate) |
| medium | 6 | CQ-006 (Playwright non-required), CQ-007 (type-escape hatches), CQ-008 (raw-fetch Stripe ×6), CQ-009 (Sentry conditional), CQ-010 (tenant test coverage), CQ-012 (Maps key committed) |
| low | 1 | CQ-013 (TODO accumulation) |
| informational | 1 | CQ-011 (test-routes gated — validated-SAFE) |

## Headline
The **quality gates are the weak layer**, not the code style. YCM auto-deploys every merge to prod (CQ-005) behind **zero required status checks** (CQ-006) and a **critical-CVE-only** dependency gate (CQ-003), while the highest-risk code — the 20.5k-line `routes.ts` money/tenant monolith (CQ-002) — is **never linted** (CQ-001, server excluded) and rides on a **single self-hosted runner** that was observed offline blocking all CI (CQ-004). The strongest single lever is making the deterministic tests required + gating prod deploy behind staging.

## Areas INSPECTED (with evidence)
- **CI quality gates** — `.github/workflows/{ci,security,fly-deploy}.yml`, branch protection API. Confirmed: server-excluded eslint, critical-only npm-audit, single self-hosted runner ×4 jobs, auto-deploy-on-push-to-main, 0 required checks + 1 review.
- **Complexity/readability** — file line counts + handler-boundary scan of `routes.ts`/`storage.ts`. Confirmed 38.5k lines across 2 files; 200–315-line handlers.
- **Type safety** — `as any`/@ts-ignore counts in the money/tenant files (37 + 14).
- **Repeated/fragile abstractions** — 6 raw `fetch()` Stripe call-sites across 4 files (incl. a generic `/v1${path}` passthrough at routes.ts:16232).
- **Observability** — `server/observability.ts` Sentry-conditional-on-DSN path.
- **test-routes prod-reachability** — `server/test-routes.ts` gate + `server/index.ts` mount. Confirmed double-gated (validated-SAFE, CQ-011).
- **Secrets hygiene** — `fly.toml` env block (committed Maps key).
- **TODO/FIXME accumulation** — 29 markers, file distribution.
- **Test surface** — 218 vitest files enumerated; presence of targeted money/webhook/tenant/reconciliation security tests confirmed.

## Areas NOT (or only partially) inspected — hand-offs & uncertainty
- **Runtime/prod facts** (read-only, no creds): whether SENTRY_DSN is actually set in prod (CQ-009 marked `needs runtime verification`); whether the Maps key is HTTP-referrer-restricted in Google console (CQ-012's real severity hinges on this).
- **Per-site money correctness** (Lane B / risk #2, #3, #5, #8): idempotency-key presence per Stripe call, webhook replay/ordering, refund/forfeit partials, reconciliation math. I flagged the *structural* fragility (CQ-008) but did NOT verify money-math correctness — that is the security/money lane's depth.
- **Per-call-site tenant-scope map** (risk #1): I confirmed spot coverage exists but did NOT build the full ~515-route inventory-vs-test cross-map (CQ-010 is a `candidate`, moderate confidence) — coordinate with the security lane.
- **Dead code / unused deps**: scoped-out of deep analysis this pass — reliable dead-code detection needs dynamic/route/config/flag-use tracing (per the dispatch's own caveat), which I did not complete; NO unused-code findings are asserted to avoid false positives.
- **Stale feature flags**: 15 flag references located across 6 files, but staleness (flag still referenced vs safe-to-remove) was not adjudicated — no finding asserted rather than guess.
- **Docs accuracy & a11y user-facing inconsistencies**: not deeply inspected this pass (axe runs inside the non-required Playwright job — see CQ-006); flagged as a gate gap, not enumerated per-page.
- **ESLint latent count on server/**: did not run eslint against server/ (no install) — CQ-001 asserts the *gap*, not the finding volume.

## Method / limitations
- Static read-only analysis on a clean `origin/main` worktree; `node_modules` symlinked from the main checkout (no `npm install` — esbuild postinstall SIGKILL risk per dispatch). No app-code modified; only these two artifacts committed.
- Line counts are `wc -l`; handler sizes are regex boundary scans (not AST) — approximate.
- Findings tie to quoted code + line; runtime/console-dependent claims are marked `needs runtime verification` or `candidate` with explicit confidence.
- Preferred fewer, well-supported findings over breadth; one finding (CQ-011) is a positive validated-safe confirmation to close a dispatch-flagged risk.
