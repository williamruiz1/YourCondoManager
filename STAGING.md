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

## Provisioned resources (as built — 2026-07-09)

Prod runs on **Neon** (`yourcondomanager-prod`, project `lucky-scene-78941627`,
branch `main`), so staging data is a **Neon branch** — an instant copy-on-write
clone of real prod data, same PG version + extensions (incl. `pgvector`),
isolated by construction. (A fresh Fly Postgres cluster was ruled out: it lacked
`pgvector`, so migration 0034 could not run there.)

| Resource | Value |
|---|---|
| Fly app | `yourcondomanager-staging` |
| URL | https://yourcondomanager-staging.fly.dev |
| DB (Neon staging branch) | `staging-review` (`br-autumn-voice-aqi2xdyc`), endpoint `ep-restless-hill-aq1le0mx` |
| `DATABASE_URL` (Fly secret) | → the Neon `staging-review` branch |
| Kill-switch env | `APP_ENV=staging`, `OUTBOUND_SIDE_EFFECTS_DISABLED=1`, `YCM_STAGING=1` (in `fly.staging.toml`) |
| Stripe | test key or unset; live keys refused at use |

## Re-provisioning from scratch (if ever needed)

```bash
# 1. App:
flyctl apps create yourcondomanager-staging --org personal
# 2. DB = Neon branch off prod main (needs Neon API key in keychain 'neon-api-key'):
#    POST /projects/lucky-scene-78941627/branches  {branch:{name:"staging-review",parent_id:"<main>"}, endpoints:[{type:"read_write"}]}
#    → take the branch's connection_uri.
# 3. Secrets:
flyctl secrets set -a yourcondomanager-staging \
  DATABASE_URL="<neon staging-review connection uri>" \
  SESSION_SECRET="$(openssl rand -hex 32)"
#    Stripe test key optional; do NOT copy prod's live Stripe/Twilio/Gmail/VAPID secrets.
# 4. Deploy the redesign branch (must contain the kill-switch — merge main first):
flyctl deploy -c fly.staging.toml -a yourcondomanager-staging
# 5. Hand William the gated URL: https://yourcondomanager-staging.fly.dev
```

---

## Refresh staging data on demand

**Primary (Neon branch reset — our setup):**
```bash
scripts/refresh-staging-neon-branch.sh   # resets the staging-review branch to prod main head
```

**Generic fallback (pg_dump, for a non-Neon staging DB):**
```bash
PROD_DATABASE_URL="postgres://.../<proddb>" \
STAGING_DATABASE_URL="postgres://.../<...staging...>" \
  scripts/refresh-staging-from-prod.sh
```
The pg_dump script dumps prod read-only, restores into the staging DB
(`--clean --if-exists`), and scrubs Twilio/VAPID/live-Stripe rows from the cloned
`platform_secrets`. It refuses to run if the staging URL doesn't contain
`staging`, or if the two URLs are identical. (Note: prod stores creds in Fly/env,
not the DB — `platform_secrets` is empty — so the scrub is a no-op backstop; the
code kill-switch is the real guarantee.)

---

## How William logs in to review (one setup step needs the Google console)

The app gate is Google OAuth (admin accounts `yourcondomanagement@gmail.com`,
`chcmgmt18@gmail.com` — both exist in the cloned data). Email magic-links are
**sinked by the kill-switch**, so Google OAuth is the login path. To enable it:

1. Set the OAuth secrets on staging (copy the app creds from prod — these are the
   login mechanism, not side-effect creds):
   ```bash
   flyctl secrets import -a yourcondomanager-staging <<'EOF'
   GOOGLE_CLIENT_ID=<prod GOOGLE_CLIENT_ID>
   GOOGLE_CLIENT_SECRET=<prod GOOGLE_CLIENT_SECRET>
   GOOGLE_CALLBACK_URL=https://yourcondomanager-staging.fly.dev/api/auth/google/callback
   GOOGLE_CALLBACK_PATH=/api/auth/google/callback
   EOF
   ```
2. **In Google Cloud Console → the YCM OAuth client → Authorized redirect URIs,
   add:** `https://yourcondomanager-staging.fly.dev/api/auth/google/callback`
   *(this is the only step that needs the Google console — William's action).*
3. Visit `https://yourcondomanager-staging.fly.dev` and sign in with a Google
   admin account. It reads the real cloned CHC data.

(A quicker alternative if console access is inconvenient: put a basic-auth edge
gate in front of staging — but per-owner views still require an app login.)

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
