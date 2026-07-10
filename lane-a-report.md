# YCM Security / Reliability / Operations Audit — Lane A Report

**Dispatch:** founder-os#10578 · **Repo:** williamruiz1/YourCondoManager @ `origin/main` (`bbb49aa`) · **Date:** 2026-07-10 · **Mode:** READ-ONLY (zero app-code changes)
**Method:** clean `origin/main` worktree; 5 parallel read-only analysis passes over the mapper's top-10 risk map; every finding tied to quoted code + line; headline findings independently re-verified against source by the lane owner (V&V — builder-can't-self-certify).

Findings catalog: `findings-a.jsonl` (29 findings, one JSON object per line, per the dispatch schema).

---

## Severity summary

| Severity | Count | IDs |
|---|---|---|
| **Critical** | 1 | A-WEBHOOK-001 |
| **High** | 7 | A-AUTHZ-001, A-AUTHZ-002, A-AUTH-001, A-STRIPE-001, A-SEC-001, A-REL-004, A-WEBHOOK-002 |
| **Medium** | 10 | A-AUTHZ-003, A-AUTHZ-004, A-STRIPE-002, A-STRIPE-003, A-SEC-002, A-OPS-003, A-REL-005, A-RECON-004, A-LEDGER-005, A-RECON-006 |
| **Low** | 9 | A-STRIPE-004, A-STRIPE-005, A-AUTH-002, A-AUTH-003, A-AUTH-004, A-AUTH-005, A-REL-006, A-WEBHOOK-003, A-LEDGER-007 |
| **Informational** | 2 | A-STRIPE-006 (cleared), A-TEST-001 (cleared) |
| **Total** | **29** | |

**Overriding context (applies to severity interpretation):** YCM has ~1 live tenant today (Cherry Hill), and the amenity money loop + portal Plaid pay are **default-OFF** behind association allowlist / env flags. So several money/tenant findings are **latent** — real design defects with **bounded current exposure** that become live at multi-tenant scale or when the flags flip. Severities are rated on the defect, with the latency called out per finding.

---

## Headline findings (independently re-verified against source by the lane owner)

1. **A-WEBHOOK-001 (CRITICAL, needs-runtime-verification) — one payment can be double/triple-credited to the owner ledger.** Three code paths each write a negative "payment" `owner_ledger_entries` row deduped in **disjoint** namespaces (webhook-event id · autopay txn id · stripe charge id), none keyed on the shared payment-intent identity. Verified: both `checkout.session.completed` (paid) and `payment_intent.succeeded` normalize to `status='succeeded'` (`routes.ts:601-607`), so if both reach the endpoint with metadata, both post a credit. Whether both fire depends on live Stripe endpoint subscriptions (not visible in code) — hence runtime-verify. **Money-ledger corruption if it fires.**
2. **A-AUTHZ-002 (HIGH) — `server/routes/records-requests.ts` has zero tenant isolation.** Verified: `getRecordsRequest(id)` filters on id only; `getRecordsRequests(undefined)` returns **all tenants' rows**; the module calls no scope helper anywhere. Any admin of any tenant can read/modify/create another tenant's CT §47-260 owner records by id. Deterministic cross-tenant confidentiality + integrity breach.
3. **A-AUTHZ-001 (HIGH) — `assertResourceScope` fails OPEN** on an unresolved/null association (`routes.ts:1216 if (!associationId) return;`), across 9 resource types with nullable association. Verified: the **sibling** `assertAssociationScope` was explicitly hardened to fail-closed ("Previously this branch short-circuited to 'allowed'") — this one was not.
4. **A-AUTH-001 (HIGH) — portal `x-portal-access-id` bearer is a permanent, non-rotating, non-revocable DB primary key** with no logout and a rolling expiry that never fires (refreshed every request). High-entropy so not enumerable, but any leak = unbounded-duration full portal access.
5. **A-SEC-001 (HIGH) — every `/api` response body is logged verbatim to prod stdout** (`server/index.ts:357-380`; `log()` not prod-gated), leaking owner PII, financial records, and auth/session tokens into Fly logs.
6. **A-REL-004 (HIGH) — auto-deploy every merge with `--strategy immediate` + auto-run migrations, no staging, no automated rollback.** A bad merge or destructive migration reaches 100% of prod instantly; image rollback doesn't revert schema.
7. **A-STRIPE-001 (HIGH, latent) — amenity forfeit/refund send no Idempotency-Key** → money-moved-but-record-unwritten desync on retry (behind the default-off GL flag).
8. **A-WEBHOOK-002 (HIGH) — `owner_ledger_entries` has no unique constraint on `(referenceType, referenceId)`** (verified: only `byAssocUnitPosted`); ledger writes are check-then-insert → concurrent duplicate webhook delivery double-inserts.

Cleared (informational, false-positive on the mapper flags): **A-TEST-001** — test routes are triple-gated (`NODE_ENV==='test' && PLAYWRIGHT_TEST_MODE==='1'`), not prod-reachable. **A-STRIPE-006** — the "generic Stripe passthrough" is not a client price-tampering vector; owner-payment amounts are server-capped and money math is integer-cents.

---

## Areas INSPECTED

- **Tenant isolation / authz:** `assertResourceScope` + `assertAssociationScope` + `getAssociationIdForScopedResource` (full), the central `getAssociationIdQuery` guard, and 7 of 16 `server/routes/*.ts` modules read in full (records-requests, amenities, meeting-prep, pressing-items, stripe-connect + main-routes governance/plaid/dashboard samples).
- **Auth & sessions / portal:** `server/auth.ts` + session config in `server/index.ts`, portal `requirePortal` + `resolvePortalAccessContext` + OTP verify + `portal_access` schema, admin scope hydration, `server/test-routes.ts` gating.
- **Stripe money:** `payment-service.ts`, `amenity-stripe-gateway.ts`, `refund-service.ts`, `stripe-idempotency.ts`, and all `routes.ts` `stripeRequest` call sites (platform billing); amenity money loop (`amenity-money-service.ts`) end-to-end.
- **Webhooks → ledger / reconciliation:** both Stripe verifiers (per-HOA inline + Connect) + Plaid verifier, `processPaymentWebhookEvent`, `writeLedgerEntryForCharge`, autopay ledger block, `plaid-reconciliation.ts`, `stripe-reconciliation.ts`, `admin-reconciliation` + `report.ts`, `owner_ledger_entries` schema.
- **Ops / secrets / reliability:** `fly.toml`, `.github/workflows/` (fly-deploy, ci, uptime, security), `server/index.ts` request logger, `server/observability.ts`, rate-limiter + job-queue design, background schedulers, repo-wide secret grep.

## Areas NOT inspected (coverage gaps — for a follow-on lane)

- **~515 handlers in `server/routes.ts` were sampled by grep-cluster, not exhaustively read** — additional un-guarded by-id handlers may exist (A-AUTHZ-004 is the systemic driver).
- **9 of 16 `server/routes/*.ts` modules were only scope-density-triaged, not line-audited:** account-statement, agent-actions, admin-disbursements, admin-payments, ai-assistant, admin-reconciliation, payment-portal, resale-certificate, autopay, violation-triage, observability-smoke-test.
- **The React CLIENT was out of scope** (portal token storage/transport on the browser, XSS surface, CSRF posture) — A-AUTH-001's client-storage medium is a hypothesis.
- **No runtime execution / live DB / Stripe-dashboard inspection** — several findings depend on live state (see Uncertainty).
- **Owner-portal (`PortalRequest`) route data-scoping** beyond the representative account-statement + uploads paths.

## Uncertainty / runtime-verification required

- **A-WEBHOOK-001 (critical):** whether both `checkout.session.completed` and `payment_intent.succeeded` (or both endpoints) actually deliver metadata-bearing succeeded events for one payment depends on the **live Stripe endpoint event subscriptions** — not visible in code. The code will double-post if it receives two such events. **Verify in the Stripe Dashboard + a signed-event test harness before rating final.**
- **A-AUTHZ-001 / A-AUTHZ-002 / A-AUTHZ-003:** static-confirmed as code defects; live blast radius depends on the actual presence of `association_id=NULL` rows and multiple tenants (data-state dependent).
- **A-LEDGER-005 (float money):** off-by-a-cent risk is demonstrable from float4 semantics but frequency depends on real amount magnitudes (a data audit would quantify).
- **A-AUTH-004:** rated low pending a trace of whether a `portal_access` row can be attacker-influenced for an admin's email.
- **Latency flags:** A-STRIPE-001/002/003, A-RECON-004, A-LEDGER-007 sit behind default-off flags (GL allowlist / `PORTAL_PLAID_PAY_ENABLED`); real impact begins when enabled.

## Recommended remediation ordering (for the YCM GM / separate build dispatches — this lane is findings-only)

1. **A-AUTHZ-002 + A-AUTHZ-001** — close the tenant-isolation holes (fail `assertResourceScope` closed with an explicit global-row allow-list; add scope checks to `records-requests` + audit the other un-line-read modules per A-AUTHZ-004). Highest-integrity, lowest-effort-to-partial.
2. **A-WEBHOOK-001 + A-WEBHOOK-002** — single canonical payment-identity idempotency key + a partial unique index on `owner_ledger_entries(referenceType, referenceId)`; verify the live Stripe subscriptions first.
3. **A-SEC-001** — stop logging response bodies (XS, near-zero risk).
4. **A-AUTH-001** — rotating/revocable portal session token (XL; phase it).
5. **A-REL-004 / A-OPS-003 / A-SEC-002** — deploy-safety + observability + key rotation.

---

*Limitations honored per dispatch: read-only, no app-code changes, no npm install, no network/prod-cred/webhook/payment side effects. Findings distinguish fact vs hypothesis via the `status` field; every `validated` finding carries quoted code + line and was cross-checked; sampling caveats are recorded per-finding under `limitations`.*
