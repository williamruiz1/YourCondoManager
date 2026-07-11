# Observability Install Runbook (founder-os#1030)

This PR ships the **code wiring** for Sentry (server + client) and GA4
(client). Provisioning the actual Sentry org / GA4 property + dropping
credentials into Fly is a William-action — those steps require billing
identity + production secret access that no worker session has.

After merging this PR, run these steps once to take observability live.

---

## Prerequisites

- William's GitHub + Fly access to `yourcondomanager` app
- A free-tier Sentry account (or paid org if billing already in place)
- William's Google account with admin access to a GA4 property

---

## Step 1 — Provision the YCM Sentry org + 2 projects

Per `~/code/founder-os/wiki/portfolio/ycm.md` convention: each portfolio
product gets its **own dedicated Sentry org**, not a shared org. Don't
reuse another product's org.

1. Sign in to https://sentry.io
2. Create a new organization named `yourcondomanager` (slug: `yourcondomanager`)
3. Inside that org, create **two projects**:
   - `ycm-server` (platform: Node.js → Express)
   - `ycm-client` (platform: JavaScript → React)
4. From each project's settings → Client Keys (DSN), copy the DSN URL.
   You should have two values: one for server, one for client.

---

## Step 2 — Provision the YCM GA4 property

Per the same convention: dedicated GA4 property per product, not a shared
property.

1. Sign in to https://analytics.google.com
2. Admin → Create property
3. Property name: `Your Condo Manager`
4. Reporting time zone: America/New_York (or your preference)
5. Currency: USD
6. Create a Web data stream:
   - URL: `https://app.yourcondomanager.org`
   - Stream name: `app.yourcondomanager.org`
7. Copy the **Measurement ID** (looks like `G-XXXXXXXXXX`)

---

## Step 3 — Install Sentry SDKs (local)

**As of the A-OPS-003 / CQ-009 PR, `@sentry/node` + `@sentry/react` are already
declared in `package.json`** (`^8.0.0`). The dynamic-import code degrades to a
no-op until they're actually installed into `node_modules`. Install them on a
machine OUTSIDE the sandbox (the sandboxed fleet worktree can't run `npm install`
— esbuild's postinstall is SIGKILL'd):

```bash
cd ~/code/YourCondoManager
npm install   # resolves the @sentry/* deps already in package.json + writes package-lock.json
```

Commit the resulting `package-lock.json` change (e.g. `chore(deps): lock
@sentry/node + @sentry/react`).

If `npm install` fails on a transitive version mismatch (a known
intermittent issue with `@sentry/core`), pin specific versions:

```bash
npm install --save @sentry/node@8.49.0 @sentry/react@8.49.0
```

---

## Step 4 — Drop the values into Fly

Server-side DSN goes into Fly **secrets** (encrypted at rest); client-side
DSN + GA4 Measurement ID go into Fly **build args** in `fly.toml` (they
get inlined into the client bundle at build time).

```bash
cd ~/code/YourCondoManager
# Server-side Sentry DSN — encrypted secret
flyctl secrets set SENTRY_DSN="<paste-from-step-1-ycm-server-DSN>"

# Optional: tag the release (helps Sentry group errors per deploy)
flyctl secrets set SENTRY_RELEASE="$(git rev-parse --short HEAD)"

# RECOMMENDED once the DSN is set: make a FUTURE missing DSN hard-fail the boot,
# so this can never silently regress to a no-op again (A-OPS-003 / CQ-009).
flyctl secrets set SENTRY_STRICT=1
```

> **Boot-time assertion (A-OPS-003 / CQ-009).** On boot in production the server
> now calls `assertServerObservabilityConfigured()`. With `SENTRY_DSN` unset it
> emits a LOUD `ERROR [observability] SENTRY_DSN is UNSET in production…` line
> (visible in `flyctl logs`) — and, when `SENTRY_STRICT=1`, hard-fails the boot
> (mirroring the Plaid F7 env-flip guard). Default is loud-warn-not-fatal so a
> missing observability secret never bricks prod; flip `SENTRY_STRICT=1` after the
> DSN is provisioned. The `/api/admin/observability-smoke-test` route reports
> `sentry.initialized` + `sentry.dsnConfigured` so you can confirm capture live.

Edit `fly.toml` under `[build.args]`:

```toml
[build.args]
    # VITE_GOOGLE_MAPS_API_KEY stays "" here — the live key is injected at
    # build time from the CI secret (see below), NOT committed to fly.toml.
    VITE_GOOGLE_MAPS_API_KEY = ""
    VITE_SENTRY_DSN = "<paste-from-step-1-ycm-client-DSN>"
    VITE_GA_MEASUREMENT_ID = "G-XXXXXXXXXX"  # from step 2
    VITE_APP_ENV = "production"
```

**Google Maps key — do NOT paste a live key into `fly.toml`** (founder-os audit
A-SEC-002 / COST-B-004 / CQ-012). It is a client-visible key by design, but
committing it to git makes rotation a code+redeploy operation and leaves the
value permanently in history. Instead, set it once as a repo secret; the Fly
deploy workflow injects it as a build-arg:

```bash
gh secret set VITE_GOOGLE_MAPS_API_KEY -R williamruiz1/YourCondoManager
# paste the RESTRICTED, ROTATED key from Google Cloud Console when prompted
```

Restrict the key in Google Cloud Console before use: (a) HTTP-referrer →
`app.yourcondomanager.org` (+ any legitimate prod/preview origins), and (b) API
restriction → only the Maps JS / Places APIs actually used. Add a billing/quota
alert as defense-in-depth.

Commit the `fly.toml` change as a separate small PR if you prefer audit
clarity, OR roll it into the `chore(deps)` PR from Step 3.

---

## Step 5 — Deploy + verify

```bash
cd ~/code/YourCondoManager
flyctl deploy
```

After the deploy finishes (~2-4 minutes), verify both pipelines:

### Verify server-side Sentry

1. Visit `https://app.yourcondomanager.org/api/admin/observability-smoke-test`
   (you must be signed in as a platform-admin)
2. Expected response: `{ ok: true, sentry: { initialized: true, dsnConfigured: true }, ... }`
3. Open https://sentry.io → `yourcondomanager` org → `ycm-server` project
4. Within 1-5 minutes, expect a new event titled **"Observability smoke test"**
   with the timestamp from the response body

### Verify client-side Sentry

1. Visit any client page (e.g. the homepage at `https://app.yourcondomanager.org`)
2. Open DevTools → Console
3. Expected log line: `[observability] Sentry React SDK initialized (env=production)`
4. Force a client-side error (e.g. throw in DevTools console:
   `import("./lib/observability.js").then(m => m.captureClientError(new Error("client smoke test")))`)
5. Within 1-5 minutes, expect a new event in the `ycm-client` Sentry project

### Verify GA4

1. From the same client page, open DevTools → Network → filter for `googletagmanager`
2. Expected: a request to `https://www.googletagmanager.com/gtag/js?id=G-XXXXXXXXXX`
3. Console log: `[observability] GA4 initialized (id=G-XXXXXXXXXX, env=production)`
4. Open https://analytics.google.com → your property → Reports → Realtime
5. Within 1-2 minutes, expect to see your session as an active user

If you also want a custom-event smoke test, call from the browser console:
```js
import("./lib/observability.js").then(m => m.trackEvent("smoke_test", { source: "manual" }))
```
Then check Realtime → Events for the `smoke_test` event.

---

## Step 6 — Backfill the ledger

Update `~/code/founder-os/wiki/portfolio/ycm.md` with the now-known values:

- Sentry org slug: `yourcondomanager`
- Server project slug: `ycm-server`
- Client project slug: `ycm-client`
- GA4 property ID: (from the GA4 property settings)
- Measurement ID: `G-XXXXXXXXXX`

Commit as `docs(ycm): backfill observability ledger fields per #1030 deploy`.

---

## Rollback

If something goes wrong, observability is fully gated by env vars — unset
the secret + build args + redeploy and the pipeline returns to no-op:

```bash
flyctl secrets unset SENTRY_DSN SENTRY_RELEASE
# Remove the three VITE_ entries from fly.toml [build.args] and redeploy
flyctl deploy
```

The code changes don't break the application if Sentry/GA4 aren't
configured — both modules log a "disabled" line and continue.

---

## Code surfaces (for reviewers / future maintainers)

- `server/observability.ts` — Sentry init + `captureServerError` helper
- `server/index.ts` — boot-time `await initServerObservability()` inside the async block
- `client/src/lib/observability.ts` — Sentry + GA4 init + `captureClientError` + `trackEvent`
- `client/src/lib/error-reporting.ts` — wrapper that routes `reportError(...)` to `captureClientError`
- `client/src/main.tsx` — boot-time `void initClientObservability()` before React render
- `server/routes/observability-smoke-test.ts` — admin-only `GET /api/admin/observability-smoke-test`
- `server/routes.ts` — registers the smoke-test route alongside other routes
- `fly.toml` — `[build.args]` entries for client SDK config

All code paths degrade to no-op when env vars are absent. Setting the
env vars + installing the SDK packages is the ONLY thing this runbook
asks you to do.
