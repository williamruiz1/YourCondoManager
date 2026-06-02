# Uptime Monitoring — YCM Production

**Status:** LIVE (as of 2026-05-27, PR #201)
**Primary monitor:** GitHub Actions workflow (`.github/workflows/uptime-monitor.yml`)
**Endpoint monitored:** `https://yourcondomanager.fly.dev/api/health`

---

## What is in place

### GitHub Actions uptime monitor

`.github/workflows/uptime-monitor.yml` pings `/api/health` every **5 minutes** (GitHub's
minimum cron interval). On failure it marks the workflow run red, which triggers a GitHub
email notification to all watchers of the repository.

**Alert recipient setup:**
1. Visit `https://github.com/williamruiz1/YourCondoManager`.
2. Click "Watch" → "All Activity" (or "Custom" → check "Workflow runs").
3. GitHub will send an email to `yourcondomanagement@gmail.com` when the workflow fails.

**What the monitor checks:**
- HTTP status code must be `200`.
- Response body must have `"status": "ok"` (it rejects degraded 200s, e.g. `{"status":"error"}`).
- Request must complete within 15 seconds.

**Detection lag:** up to 5 minutes (GitHub's minimum cron interval).

### Neon + Fly resilience (underlying change, not a monitor)

The 2026-05-25 Fly Postgres outage caused a 3-hour detection lag because there was no
external monitor. Since then:

1. **Database migrated to Neon** — storage is decoupled from Fly compute. A Fly machine
   restart no longer takes the database down.
2. **GitHub Actions monitor wired** — `/api/health` is externally verified every 5 minutes.

The combination means: even if a Fly machine exits, the app's Fly health checks will
restart it, and the GitHub Actions monitor will alert William if the endpoint is down for
more than one 5-minute check cycle.

---

## What still needs William's action

### W-A — Better Stack (recommended for faster alerts)

The GitHub Actions monitor has a 5-minute minimum. For a production HOA billing
platform, **30-second checks with mobile push** (Better Stack free tier) are the right
floor. Better Stack requires a William-held account.

Setup: follow `scripts/uptime/setup-betterstack.md` — ~5 minutes.

**Why this matters:** the 2026-05-25 outage lasted 3 hours because there was no alert.
With a 5-minute GitHub Actions check, detection lag is at most 5 minutes — much better.
With Better Stack's 30-second check and mobile push, detection lag is under 1 minute
and you get a push notification to your phone, not just an email.

### W-B — Destroy the old Fly Postgres machine

The old Fly Postgres machine (`d8d26d7a242678`, app `yourcondomanager-db`) was kept
as a 7-day rollback safety net after the 2026-05-27 Neon migration. It was due for
destruction by **2026-06-03** and is now past that date. It may OOM-cycle again and
create a confusing alert if anyone is watching it.

```bash
flyctl machine destroy d8d26d7a242678 -a yourcondomanager-db --force
```

---

## Future improvements (optional, post-pilot)

- **Better Stack** (W-A above) — 30-second checks, mobile push, incident history.
- **Sentry alert rule** on consecutive `/api/health` failures (second detection channel,
  as noted in the incident postmortem). Requires `SENTRY_DSN` to be set (gate E.1).
- **Daily `pg_dump` workflow** — see `docs/operations/neon-backup-restore-runbook.md`
  §Automated daily backup via GitHub Actions.

---

## Lineage

- **2026-05-25** — Production outage. No uptime monitor. Detection lag ~3 hours.
- **2026-05-27** — PR #201 merged. GitHub Actions uptime monitor wired. Neon migration complete.
- **2026-06-02** — This doc authored. P1-2 acceptance criteria assessed. Monitor is live;
  Better Stack (W-A) remains a recommended William-action for faster alerting.
