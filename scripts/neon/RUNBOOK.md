# Neon Migration Runbook — YCM Production

**Target:** founder-os#2470 — move YCM production database off the single-node 256 MB Fly Postgres instance that took us down for 3 hours on 2026-05-25, onto Neon (managed Postgres with built-in failover, PITR, autoscaling).

**Expected downtime:** **3–5 minutes**. Brief, controlled, scheduled. No data loss in the worst case (we keep the Fly Postgres machine running for 7 days as a backup; rollback is one command).

**Read this entire document before starting.** Once you start, follow it in order. Do not improvise.

---

## Pre-flight (do once, days before cutover)

These can all be done at leisure. They make the cutover itself a 5-minute operation.

### 0.1 — Capture the current Fly Postgres connection string

This is the value the auto-rollback script needs. **You must save it now**, because Fly does not let you read back a secret value after it's been set.

If you saved the original `DATABASE_URL` somewhere (Keychain, password manager, notes) when you originally wired Fly Postgres, retrieve it and skip to 0.2.

If you didn't save it, derive it from the Fly Postgres app credentials:

```bash
# This shows the internal hostname (flycast) — the value before '?sslmode=disable'
flyctl status -a yourcondomanager-db | grep -i flycast

# The full DATABASE_URL has this shape:
#   postgres://postgres:<password>@yourcondomanager-db.flycast:5432/yourcondomanager?sslmode=disable
# You can fetch the password from:
flyctl ssh console -a yourcondomanager-db --pty=false -C 'sh -lc "echo $OPERATOR_PASSWORD"'
```

Assemble the URL and save it to your Mac's keychain:

```bash
security add-generic-password -a "$(whoami)" -s 'fly-pg-old-database-url' -w 'postgres://postgres:<pwd>@yourcondomanager-db.flycast:5432/yourcondomanager?sslmode=disable' -U
```

You'll retrieve it at cutover time with:

```bash
export FLY_PG_OLD_DATABASE_URL="$(security find-generic-password -a "$(whoami)" -s 'fly-pg-old-database-url' -w)"
```

### 0.2 — Provision the Neon project

Follow **[scripts/neon/01-provision.md](./01-provision.md)** — ~5 minutes of UI clicks in the Neon console. You'll come out with two URL strings exported in your shell:

```bash
export NEON_DATABASE_URL_DIRECT='postgresql://...aws-us-east-1.neon.tech/...?sslmode=require'
export NEON_DATABASE_URL_POOLED='postgresql://...-pooler.aws-us-east-1.neon.tech/...?sslmode=require'
```

### 0.3 — Set up the uptime monitor

Follow **[scripts/uptime/setup-betterstack.md](../uptime/setup-betterstack.md)** — ~5 minutes. Get the 30-second monitor on `/api/health` AND the mobile push tested AND the maintenance window scheduled for your planned cutover slot.

Programmatic alternative if you prefer: `./scripts/uptime/setup-uptimerobot.sh` (5-min check interval; weaker but fully scripted).

### 0.4 — Dry-run every script

Before cutover day:

```bash
./scripts/neon/02-export-fly-postgres.sh --dry-run
./scripts/neon/03-import-to-neon.sh /tmp/whatever.sql --dry-run   # pass any path; dry-run doesn't read it
./scripts/neon/04-cutover.sh --dry-run
./scripts/neon/05-rollback.sh --dry-run
./scripts/neon/06-verify.sh --post-cutover    # will run actual DB-level checks; safe to run anytime
```

Each script's `[dry-run]` output should match this runbook. If anything is unclear, surface it before cutover day.

---

## Cutover day — the 5-minute window

Schedule: **outside billing windows, outside Cherry Hill go-live activity.** Confirm with William first.

### Step 1 — Open the maintenance window (T-10 min)

In Better Stack (or UptimeRobot): mark a 15-minute maintenance window starting **NOW**.

This silences the uptime alert during cutover so you don't get paged at minute 2 of your own planned downtime.

### Step 2 — Export Fly Postgres to a local dump (T-5 min)

```bash
./scripts/neon/02-export-fly-postgres.sh
```

**Expected output:**

- Dump file at `/tmp/ycm-prod-dump-<stamp>.sql` (a few MB for current YCM size).
- Counts file at `/tmp/ycm-prod-dump-<stamp>.counts.txt` listing pre-cutover row counts.
- Total time: 30-90 seconds.

If the script exits non-zero or the dump is suspiciously small (<10 KB), **STOP**. Do not proceed. Investigate.

### Step 3 — Import into Neon (T-3 min)

```bash
./scripts/neon/03-import-to-neon.sh /tmp/ycm-prod-dump-<stamp>.sql
```

**Expected output:**

- "Target is fresh — no 'associations' table yet" (because Neon is empty).
- "Import complete in <N>s" — typically 30-90 seconds.
- "Drift check" lines, all `[match]`.
- "All tables match source counts."

If drift is reported, **STOP**. Investigate before continuing. The most common cause is a write to Fly Postgres landing between the export and import — if so, re-run from step 2 during a quieter moment.

### Step 4 — Run verify against Neon (T-2 min, optional but recommended)

Catch problems in Neon BEFORE flipping the secret. This runs the DB-level checks only (does not hit the live app yet):

```bash
./scripts/neon/06-verify.sh
```

**Expected:** all `[ok]` lines. Cherry Hill association has 18 units, 17 persons, 20 ownerships, 19 ledger entries. Drizzle migrations table has 33 entries.

If anything `[FAIL]`s, **STOP**. The data is in Neon but something is off. Investigate and possibly re-run step 3 with a fresh dump.

### Step 5 — THE CUTOVER (T-0 — this is the downtime window)

```bash
export FLY_PG_OLD_DATABASE_URL="$(security find-generic-password -a "$(whoami)" -s 'fly-pg-old-database-url' -w)"
export PORTAL_VERIFY_TOKEN='<William portal token>'   # optional but recommended

./scripts/neon/04-cutover.sh
```

**What happens (timeline you should see):**

- t+0s — Script writes the new DATABASE_URL secret to Fly (staged, not yet active).
- t+5s — `flyctl deploy --strategy rolling` starts. Fly creates a release with the new env and begins replacing machines one at a time. Each machine: start → health check → ready → next machine.
- t+30s to t+180s — Rolling deploy completes. The site IS up the entire time on at least 1 machine, but DB queries from a given machine may briefly fail between its restart and Neon-side connection establishment.
- t+~30s — Script begins polling `https://yourcondomanager.fly.dev/api/health`. As soon as it returns 200, moves on.
- t+~35s — Script fetches William's `/api/portal/financial-dashboard` and asserts `currentBalanceCents == 561861` ($5,618.61).
- t+~40s — `[done] Cutover complete in <N>s. YCM is now on Neon.`

**If verification fails at any point, the script automatically rolls back** (calls `05-rollback.sh` internally) and exits with code 2. You see `[ok] Rollback succeeded. Back on Fly Postgres.` and the site is exactly where it was 5 minutes ago.

**Total real downtime experienced by a user mid-request: typically 0 seconds** (rolling deploy keeps at least 1 machine serving) **to a few seconds** (if their connection hits a machine mid-restart). The Fly machines themselves never go to zero.

### Step 6 — Full post-cutover verification (T+1 min)

```bash
./scripts/neon/06-verify.sh --post-cutover
```

**Expected:** all `[ok]` lines, including:

- DB-level checks against Neon (same as step 4).
- `GET /api/health → 200`.
- `GET /api/portal/financial-dashboard → 200`.
- `William's currentBalanceCents = 561861`.
- `GET /api/portal/ledger → 200`.

### Step 7 — Close the maintenance window + smoke test the UI (T+2 min)

1. In Better Stack: close the maintenance window early (or let it expire). Alerts resume.
2. Open `https://yourcondomanager.fly.dev` in a browser. Log in as William. Navigate to the portal finances page. Confirm the $5,618.61 balance is showing. Click into one of his 3 units' ledgers — confirm entries load.
3. Hit `/api/health/details` (requires admin login) — confirm associations/persons/ownerships counts match expectations.

### Step 8 — Wait + watch (T+10 min through T+24h)

- Keep the Better Stack monitor visible for the next ~30 minutes. If `/api/health` flaps, the monitor pages you immediately.
- The Fly Postgres app machine stays running for the next 7 days as a hot rollback target. Do NOT destroy it until you're confident Neon is stable.
- After 7 days clean: `flyctl apps destroy yourcondomanager-db` (separate ticket; not part of #2470).

---

## Rollback decision criteria

**Automatic rollback fires when:**
- `flyctl deploy` fails or times out (300 s).
- `/api/health` does not return 200 within 180 s of deploy completion.
- William's portal `currentBalanceCents` does not equal 561861 (when `PORTAL_VERIFY_TOKEN` is set).

**Manual rollback — run `./scripts/neon/05-rollback.sh` immediately if:**
- The script exits 0 (cutover "succeeded") but the UI shows weird data (missing units, wrong balances, broken queries).
- Sentry starts logging a flood of DB errors that didn't exist on Fly Postgres.
- The Better Stack monitor goes red (false negative against the script's verify).
- William says so. No questions; run rollback.

```bash
export FLY_PG_OLD_DATABASE_URL="$(security find-generic-password -a "$(whoami)" -s 'fly-pg-old-database-url' -w)"
./scripts/neon/05-rollback.sh
```

Recovery time: same shape as cutover (rolling redeploy + health check). ~3-5 min.

**Do NOT roll back if:**
- A non-critical feature is misbehaving but the core portal + admin flows work. Investigate in place first. Rolling back means you have to redo the entire migration; only roll back for "this is materially broken for users" issues.

---

## Post-cutover verification checklist

Use this as the final sanity pass before closing #2470.

- [ ] `/api/health` returns `{"status":"ok"}` (Better Stack monitor green).
- [ ] Browser login as William works.
- [ ] `/portal/finances` shows $5,618.61 balance.
- [ ] Each of William's 3 units shows its ledger when clicked.
- [ ] Admin sidebar loads associations list including Cherry Hill Court Condominiums.
- [ ] `/api/health/details` (admin) shows associations=N, units=18 for Cherry Hill, persons matching pre-cutover count.
- [ ] Bank-feed sync still working — trigger a manual sync from admin and confirm transactions land.
- [ ] No Sentry error spike since cutover timestamp.
- [ ] Better Stack monitor has had ≥30 minutes of clean checks.
- [ ] portfolio/YCM.md updated to reflect Neon as the provider (separate sibling PR on founder-os).
- [ ] Postmortem `docs/incidents/2026-05-25-fly-postgres-down.md` updated with the cutover date + outcome.

---

## What to do if cutover succeeds but you find a problem 4 hours later

1. Run `06-verify.sh --post-cutover` to see exactly what's broken.
2. If it's a data-level issue: pick the latest dump from `/tmp/ycm-prod-dump-*.sql` (kept for 7 days) and compare counts against current Neon.
3. If it's an app-level issue (slow query, connection-pool exhaustion): check Neon's compute metrics. The 0.25 CU autoscaling default may need bumping.
4. If it's wholesale broken: rollback to Fly Postgres via step 5 above, then investigate from a calm position.

The dump is your safety net for 7 days. Don't delete it early.

---

## Files in this kit

| Path                                       | What it is                                              |
|--------------------------------------------|---------------------------------------------------------|
| `scripts/neon/01-provision.md`             | Manual Neon UI steps + capture both connection strings  |
| `scripts/neon/02-export-fly-postgres.sh`   | pg_dump via flyctl ssh; outputs `/tmp/ycm-prod-dump-*.sql` |
| `scripts/neon/03-import-to-neon.sh`        | psql import + source-vs-Neon row-count drift check       |
| `scripts/neon/04-cutover.sh`               | The cutover. Sets Fly secret, rolls deploy, verifies, auto-rolls-back on failure |
| `scripts/neon/05-rollback.sh`              | Emergency rollback. Reverts DATABASE_URL + rolls deploy |
| `scripts/neon/06-verify.sh`                | Audit pass — DB checks (default) + live endpoint checks (`--post-cutover`) |
| `scripts/uptime/setup-betterstack.md`      | Better Stack UI runbook (recommended; 30 s checks)      |
| `scripts/uptime/setup-uptimerobot.sh`      | UptimeRobot API automation (fallback; 5 min checks)     |

---

## Lineage

- **2026-05-24** — Authored. Founder-os#2470 prep. PR ships scripts only; production cutover deferred until William picks a window.
- Sibling: docs/incidents/2026-05-25-fly-postgres-down.md (the postmortem that originated this work).
