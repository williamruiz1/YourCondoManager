# Production Outage — Fly Postgres Down (2026-05-25)

**Severity:** SEV-1 — total customer-facing outage
**Duration:** ~3h 10m (12:45 UTC → 15:55 UTC, 2026-05-25)
**Status:** Resolved. Remediation in flight at founder-os#2470.

---

## Summary

Production `yourcondomanager.org` returned HTTP 503 to every visitor for ~3 hours on 2026-05-25. Root cause: the Postgres process inside the single-node Fly Postgres machine (`d8d26d7a242678`, app `yourcondomanager-db`) died and did not auto-recover. The web app stayed up but every request failed at the database call, so the Fly proxy stopped passing traffic to it and logged `[PR01] no known healthy instances`. Recovery was a single `flyctl machine restart` from a live strategist session. No data loss; no successful payment requests during the window.

## Timeline (UTC, 2026-05-25)

- **12:45** — Postgres process exits inside machine `d8d26d7a242678`. `repmgrd` inside the machine begins logging `connection to database failed — Connection refused on port 5433` and never stops for the next 3 hours.
- **12:45 → 15:55** — App machines return `{"status":"error","message":"Database unreachable"}` on `/api/health`. Fly proxy marks the app unhealthy and returns 503 to all external requests. No alert fires. No one is paged.
- **15:50** — William attempts a payment-test login as part of Cherry Hill go-live verification. Login fails. Reports the outage.
- **15:52** — Strategist session opens. `flyctl status -a yourcondomanager` confirms app machines unhealthy; `flyctl logs -a yourcondomanager-db` shows the repmgrd loop.
- **15:55** — `flyctl machine restart d8d26d7a242678 -a yourcondomanager-db`. Postgres comes back. All 3 health checks pass within ~20 seconds. `/api/health` returns 200.
- **15:56** — Site recovered. William re-runs the payment-test login successfully.

## Impact

- **Customer-facing:** 100% of visitors received 503 for the entire ~3-hour window.
- **Business:** Cherry Hill go-live verification was interrupted at the payment-test step. No real customer payments were in flight (the pilot tenants weren't transacting at the moment of failure), so no money was lost mid-flow — but the outage would have been money-losing during a normal billing window.
- **Data:** None. Postgres came back with all data intact.
- **Detection lag:** ~3 hours. The outage was discovered only because William happened to try a login. There was no automated alert.

## Root Cause

The Postgres process inside the Fly Postgres machine (`d8d26d7a242678`) died and did not restart. The machine itself stayed up — `repmgrd` kept running and kept logging the failed reconnect attempts — but the database listener was gone, and nothing inside the machine knew how to bring it back. From the app's perspective, the database simply stopped answering.

The most likely proximate cause is an OOM kill on the 256 MB shared-CPU instance, but we did not capture a heap dump before the restart so this is inferred from instance sizing, not proven from logs.

## Contributing Factors

1. **Undersized database instance.** 256 MB shared-CPU is below Fly Postgres's own recommended floor for any production workload. A single connection burst or large query can OOM the box.
2. **Single-node Postgres — no failover replica.** There is exactly one Postgres machine. When it dies, the database is down. Period. There is no automatic failover because there is no second node to fail over to.
3. **No external uptime monitor.** `/api/health` was returning `{"status":"error"}` for ~3 hours and nothing was watching it. No UptimeRobot, no BetterStack, no Fly alert, no PagerDuty. The first alert was William manually trying to log in.
4. **Portfolio ledger doc drift.** `founder-os/wiki/portfolio/YCM.md` said the database was Neon. Production was actually Fly Postgres. That drift cost ~10 minutes in the diagnosis path — the strategist initially looked at the wrong dashboard. Documentation that lies about production architecture is worse than no documentation at all.
5. **No internal restart-on-crash inside the Postgres machine.** Fly Postgres machines don't have a supervisor inside that restarts the Postgres process if it dies. `repmgrd` watches replication, not the local Postgres process.

## Detection

The outage was detected by William attempting a payment-test login as part of Cherry Hill go-live verification at ~15:50 UTC. There was no automated alert. There was no Sentry breadcrumb that crossed a threshold. There was no Fly notification. The site was down for ~3 hours before anyone noticed.

This is the single most important finding in this postmortem: **we had no way to know the site was down except by trying to use it.**

## Recovery

```
flyctl machine restart d8d26d7a242678 -a yourcondomanager-db
```

That was the entire recovery. Postgres came back, health checks passed in ~20 seconds, app went green, traffic returned. The whole recovery took under a minute once the right command was run.

## Lessons Learned

1. **A production database that you can't fail over from is a production database that will take you down for hours when it dies.** The "single 256 MB Fly Postgres machine" pattern was never going to survive contact with reality. The fact that it lasted as long as it did is luck, not design.
2. **No uptime monitor on `/api/health` is the same as having no monitoring.** Internal health checks tell the Fly proxy to stop routing — they don't tell *us* anything. External monitoring is the floor, not a nice-to-have.
3. **Documentation that lies about production is an active liability.** The "Provider: Neon" entry in the portfolio ledger sent the strategist to the wrong dashboard first. Doc drift on infrastructure entries needs a different discipline than doc drift on, say, brand colors — it directly affects time-to-recovery.
4. **A 3-hour detection lag means real money on a real billing day.** This outage happened to land outside a billing window. The next one might not.

## Remediation

Tracked at **founder-os#2470** — Neon migration + uptime alert dispatch. The scope of that issue:

1. **Migrate the database to Neon** (matches the documented architecture; gets us a managed Postgres with built-in failover, point-in-time restore, and proper monitoring).
2. **Wire an external uptime monitor on `/api/health`** with paging to William's phone (BetterStack or UptimeRobot — TBD per #2470 research).
3. **Refresh the portfolio ledger entry** so the documented architecture matches reality going forward (covered in this commit's sibling PR on founder-os).
4. **Add a Sentry alert rule** on consecutive `/api/health` failures so we have a second detection channel.

Until #2470 lands, the production database is the same single 256 MB Fly Postgres machine that just went down. We are not safe yet. The remediation is the work, not the postmortem.

---

**Author:** Strategist session, 2026-05-25
**Lineage:** Cherry Hill go-live verification → discovered 503 → diagnosed Fly Postgres exit → restarted machine → opened founder-os#2470 → wrote this postmortem.
