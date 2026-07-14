# Mapper Summary — YCM audit (Phase 1+2)

**Ref:** origin/main @ 1e6f941, clean worktree /tmp/ycm-audit (shared checkout unusable: stale artifact branch + 88 dirty other-agent files — see audit-charter.md).

## Key stats
- 1 deployable: Express 5 + React 18/Vite SPA, TypeScript ESM, Node 20, Fly.io single machine (ewr) + `ycm_uploads` volume.
- ~515 unique routes: `server/routes.ts` = **20,553 lines / 644 registrations** + 16 extracted modules (92 more).
- DB: Neon Postgres, Drizzle — **183 pgTables** in shared/schema.ts (4,910 lines), 58 migrations, deploy-gating `release_command` migrator + `/api/health` migration-hash 503.
- Auth: admin = Passport Google OAuth (6-role enum); portal = OTP → `x-portal-access-id` bearer HEADER (not Passport). Tenant scope = per-call-site `assertAssociationScope` (fail-closed, recently hardened).
- Stripe = **raw fetch, no SDK** (checkout, subscriptions, Connect, amenity gateway). Plaid sandbox w/ webhook-JWT verify + env-flip guard.
- Money flags: GL + amenity money loop default OFF behind `GL_ENABLED_ASSOCIATIONS` allowlist + reconcile-to-cent gate; `ASSESSMENT_EXECUTION_UNIFIED` default ON (sole ledger poster).
- CI: 4 gates + prod deploy ALL on one self-hosted Mac runner; auto-deploy every merge; visual Playwright non-required.
- **Corrections to brief:** NO staging app/fly.staging.toml, NO `OUTBOUND_SIDE_EFFECTS_DISABLED` anywhere; route count ~515 not ~141; tables 183 not 169. Sentry NOT installed (dynamic-import stub; DSNs empty).

## Top 10 highest-risk areas for specialist lanes
1. **Tenant-isolation coverage** — scope assertion is per-call-site across ~515 routes in a 20.5k-line monolith; one miss = cross-tenant data leak. Also `assertResourceScope` passes when the resource's association can't be resolved.
2. **Stripe raw-fetch money calls** — no SDK idempotency/retry defaults; audit every call site (routes.ts:6227, :16232 generic passthrough, payment-service.ts, amenity-stripe-gateway.ts, storage.ts) for idempotency keys, error handling, amount math.
3. **Webhook → ledger integrity** — Stripe event replay/out-of-order/idempotent-processing; Plaid webhook verify path.
4. **Portal auth** — `x-portal-access-id` bearer header lifecycle (rotation/expiry/revocation/brute-force), OTP issuance + email dependency (Gmail SMTP).
5. **Amenity money loop (HEAD commit) pre-flip review** — refund/forfeit lifecycle, charge-succeeded-but-column-write-failed partials, before `GL_ENABLED_ASSOCIATIONS` gets CHC.
6. **No staging + auto-deploy + no error telemetry** — every merge hits the live customer; only CI, `/api/health`, and a 5-min uptime cron stand between a bad merge and CHC.
7. **Single-machine coupling** — in-memory rate limiter, in-process job queue, volume-bound uploads vs Fly auto-stop/machine-replacement; scale-out breaks all three.
8. **Reconciliation correctness** — Plaid tx sync ↔ owner-ledger matching, duplicate/partial-payment handling (`admin-reconciliation.ts`, `bank-feed-sync.ts`).
9. **Secrets/CI hygiene** — Google Maps API key committed in fly.toml build args; whole merge+deploy pipeline on one Mac runner; security.yml blocks critical CVEs only; eslint covers client/ only.
10. **Session/OAuth fragility** — recent auth-session-parity doc (2026-07-09) + OAuth-loop fix history; cookie-domain scoping, admin session hydration, `test-routes.ts` prod-reachability.
