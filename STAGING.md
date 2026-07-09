# YourCondoManager — Staging Review Environment (founder-os#10193 F0)

`yourcondomanager-staging` is a private Fly app that runs the **redesign branch**
against a **cloned, isolated copy of the real Cherry Hill Court production data**
(real owners, units, ledger, balances). It is the review gate: William reviews the
redesign on realistic records here **before** anything ships to the live app.

**It can never act on the real world.** Browsing/clicking staging does not email,
text, push, or charge a real owner, and never touches the production database.

---

## Safety model (how "no side effects" is guaranteed)

Three independent layers — any one is sufficient; together they are defence in depth:

| Layer | Mechanism | File / setting |
|---|---|---|
| **Code kill-switch (primary)** | `outboundSideEffectsDisabled()` short-circuits email/SMS/push to a `staging-sink` no-op and **refuses any live Stripe key (`sk_live_…`)** at the point of use | `server/staging-guard.ts` + guards in `email-provider.ts`, `sms-provider.ts`, `push-provider.ts`, `routes.ts`/`services/*` Stripe sites |
| **Env activation** | The switch is tripped by `OUTBOUND_SIDE_EFFECTS_DISABLED=1` / `APP_ENV=staging` / `YCM_STAGING=1` — all three set on the staging app only. Prod sets none → prod unchanged | `fly.staging.toml [env]` |
| **DB scrub (belt & suspenders)** | The clone script deletes Twilio/VAPID/live-Stripe rows from the cloned `platform_secrets`, so the DB-fallback credential path is empty in staging | `scripts/refresh-staging-from-prod.sh` step 3 |

Plus: **Stripe TEST mode only** (staging's `PLATFORM_STRIPE_SECRET_KEY` is a `sk_test_…`
key, or unset → "not configured"); **noindex** (`X-Robots-Tag: noindex` + disallow-all
`robots.txt`, `server/index.ts`); **gated** (reuses the app's existing session/auth gate).

> Fail-safe direction: if the env flag is somehow NOT set, side effects would fire —
> so the flag **must** be set on the staging app (it is, in `fly.staging.toml`), and
> the clone scrub is the backstop.

---

## One-time setup (provision the staging app)

```bash
# 1. Create the staging app (no deploy yet).
flyctl apps create yourcondomanager-staging --org personal

# 2. Provision the staging database.
#    Option A (separate cluster — strongest isolation):
flyctl postgres create --name yourcondomanager-staging-db --org personal --region ewr \
  --vm-size shared-cpu-1x --volume-size 1 --initial-cluster-size 1
flyctl postgres attach yourcondomanager-staging-db -a yourcondomanager-staging
#    Option B (separate DATABASE on the existing prod cluster — cheaper, still isolated):
#      create a `*_staging` database on yourcondomanager-db and set DATABASE_URL to it.

# 3. Set the staging secrets. The staging DB URL is set by `postgres attach` (option A).
#    Stripe: a TEST key, or leave unset. All other real creds are omitted on purpose.
flyctl secrets set -a yourcondomanager-staging \
  SESSION_SECRET="$(openssl rand -hex 32)" \
  PLATFORM_STRIPE_SECRET_KEY="sk_test_...redacted..."     # or skip this line entirely
#    (Do NOT copy prod's live Stripe/Twilio/Gmail/VAPID secrets to staging.)

# 4. Clone real CHC data into staging + scrub creds (see next section).

# 5. Deploy the redesign branch to staging.
git checkout design/9299-redesign-prototype-r1   # or the current redesign integration branch
flyctl deploy -c fly.staging.toml -a yourcondomanager-staging

# 6. Hand William the gated URL: https://yourcondomanager-staging.fly.dev
```

---

## Refresh staging from prod (re-clone on demand)

Run any time to reset staging to the latest real data:

```bash
# Expose both DBs (or build the two URLs from the cluster creds), then:
PROD_DATABASE_URL="postgres://.../<proddb>" \
STAGING_DATABASE_URL="postgres://.../<...staging...>" \
  scripts/refresh-staging-from-prod.sh
```

The script dumps prod (read-only), restores into the staging DB (`--clean --if-exists`),
and scrubs Twilio/VAPID/live-Stripe rows from the cloned `platform_secrets`. It refuses
to run if the staging URL doesn't contain `staging`, or if the two URLs are identical.

---

## Verify the kill-switch (do this after every deploy)

```bash
# noindex present:
curl -sI https://yourcondomanager-staging.fly.dev/robots.txt        # → Disallow: /
curl -sI https://yourcondomanager-staging.fly.dev/ | grep -i x-robots-tag   # → noindex, nofollow ...
curl -sI https://yourcondomanager-staging.fly.dev/ | grep -i x-ycm-environment  # → staging

# outbound suppressed (log check): trigger an action that would email/text in prod,
# then confirm the staging logs show "[staging-guard][*-sink] suppressed outbound":
flyctl logs -a yourcondomanager-staging | grep staging-guard

# live-Stripe refusal: staging must not carry sk_live_ — a live key throws at use.
```

---

## Promote to production (William-signoff gate — the fleet does NOT cross this)

1. William reviews the redesign on staging (real data, new UI) and **signs off**.
2. Merge the reviewed redesign branch into `main` via PR (normal review).
3. Prod deploys from `main` on merge (`fly.toml`, app `yourcondomanager`).
4. **No redesign reaches the live app without step 1.** All redesign slices
   (F1/F2, M0–M9, P0–P6, O0–O5) deploy to `yourcondomanager-staging` until then.

Staging and prod share code but differ only in:
`fly.staging.toml` (app name, staging DB, kill-switch env, `VITE_APP_ENV=staging`).
