# Uptime Monitor Setup — Better Stack (recommended)

**Time:** ~5 minutes. **Who runs this:** William (UI step — Better Stack account is under his identity).
**Why Better Stack over alternatives:**

| Provider          | Free-tier check interval | Mobile push        | SMS to phone        | API for automation | Winner for YCM |
|-------------------|--------------------------|--------------------|---------------------|--------------------|----------------|
| **Better Stack**  | 30 seconds               | Yes (native app)   | Limited free SMS    | Yes                | **Yes** for primary |
| UptimeRobot       | 5 minutes (free)         | Yes (native app)   | No on free          | Yes                | OK fallback |
| Healthchecks.io   | N/A (cron-style)         | No                 | No                  | Yes                | Wrong tool — push-based |
| Pingdom           | 1 minute                 | Yes                | Paid only           | Yes                | Costs money |

Better Stack gives us 30-second checks AND mobile push for free. UptimeRobot's free tier is 5-minute, which means we'd see the 2026-05-25-class outage 5x slower than necessary. We had a 3-hour detection gap last time; 30 seconds is the right floor.

A programmatic UptimeRobot fallback (auto-creates the monitor via API) is in `scripts/uptime/setup-uptimerobot.sh` — use it only if William doesn't want a Better Stack account.

---

## 1. Create the Better Stack account (skip if already have one)

1. Go to https://uptime.betterstack.com/users/sign-up.
2. Sign up with `yourcondomanagement@gmail.com` (this is the inbox that already routes YCM ops mail).
3. Verify the email.
4. On the welcome screen, choose **"Skip team setup for now"** if it asks.

## 2. Install the Better Stack mobile app on William's phone

1. iOS App Store: **"Better Stack"** by Better Stack Inc.
2. Sign in with the same `yourcondomanagement@gmail.com` account.
3. Allow notifications when prompted. The phone IS the alert channel — without this, you only get email, which means you find out about an outage when you check Gmail.

## 3. Create the uptime monitor

1. In Better Stack web UI: **Monitors** → **Create monitor**.
2. **Monitor type:** HTTPS / HTTPS pings.
3. **URL:** `https://yourcondomanager.fly.dev/api/health`
4. **Name:** `YCM production health`
5. **Check frequency:** **30 seconds** (the free-tier minimum and what we want).
6. **Regions:** check from at least 2 regions. Default `us-east-1` + `eu-west-1` is fine.
7. **Request method:** GET. No body, no auth header.
8. **Expected status code:** `200`.
9. **Expected response body contains:** `"status":"ok"` (the literal substring — Better Stack does substring match, not JSON parsing, so the quotes go inside the value).
10. **Request timeout:** 10 seconds.
11. **Recovery period:** 1 success after failure → mark as recovered.
12. **Confirmation period:** require 2 consecutive failures from 2 regions before alerting. This prevents single-region flakes from paging.

## 4. Configure the on-call escalation policy

1. **On-call calendar:** default to William, 24/7. (No team yet; this is fine.)
2. **Escalation policy:** 3 steps:
   - **Step 1 — Immediate:** push notification to the Better Stack mobile app on William's phone.
   - **Step 2 — After 5 minutes still unacked:** email to `yourcondomanagement@gmail.com`.
   - **Step 3 — After 15 minutes still unacked:** email to William's personal address `williamruiz11@gmail.com` (already configured as a backup in some other tools; reuse it here).
3. Note: SMS on Better Stack free is limited (handful per month). If William prefers SMS at step 2, upgrade to paid OR add a Twilio-driven SMS via webhook later.

## 5. Add the maintenance window for the Neon cutover

**Critical — do this BEFORE running scripts/neon/04-cutover.sh.** Without a maintenance window, the brief downtime during cutover will fire an alert, William will get paged, and the on-call panic cycle will start mid-cutover.

1. In Better Stack: **Monitor → YCM production health → Maintenance**.
2. **New maintenance window:**
   - **Start:** the moment William plans to trigger `04-cutover.sh`.
   - **Duration:** **15 minutes** (covers a worst-case rollback + investigation, not just the ~3-5 min cutover).
   - **Suppress notifications:** yes.
3. Save.
4. **After cutover succeeds and 06-verify passes,** manually close the maintenance window (or let it expire). Alerts resume automatically.

## 6. Test the alert path BEFORE cutover

The single worst time to discover that mobile push isn't actually reaching the phone is during an outage. Test it now.

1. In Better Stack: **Monitor → YCM production health → Test alert**.
2. Verify the push lands on William's phone within 30 seconds.
3. Verify the email arrives at `yourcondomanagement@gmail.com` within 5 minutes (if step 2 of escalation is set).
4. Ack the test alert from the phone to confirm the ack flow works.

If push doesn't land:
- Check phone notification permissions for Better Stack: Settings → Notifications → Better Stack → Allow Notifications ON.
- Check that the phone is signed in to the same Better Stack account (Settings → Account inside the app).
- Force-quit and reopen the app once to refresh the device token.

## 7. Done — proceed

Once the test alert reaches the phone AND the maintenance window is scheduled for cutover, this step is complete. The monitor will run forever from now on; only re-touch it to update the URL or escalation policy.

---

## What the alert payload looks like

When the monitor fires, the push notification body will be roughly:

> **YCM production health is DOWN**
> `GET https://yourcondomanager.fly.dev/api/health` returned 500 (expected 200) — confirmed from us-east-1 + eu-west-1.
> Tap to view incident · Tap and hold to acknowledge.

The Better Stack incident page will have: the failing response body, the 24-hour status timeline, and a one-click "ack" button. Acking pauses escalation steps 2 and 3.

## What gets stored where

| Item                          | Where                                                                  |
|-------------------------------|------------------------------------------------------------------------|
| Monitor config                | Better Stack dashboard (`uptime.betterstack.com`)                      |
| Incident history              | Better Stack dashboard (kept for 1 year on free tier)                  |
| API key (if scripted later)   | Save in Keychain entry: `betterstack-ycm-api-token` (see §Future)      |

## Future automation (optional, not required for cutover)

If we want to manage this monitor as code later, Better Stack has a clean API (`api.betterstack.com`). A future script in this folder can use it. Not in scope for #2470 prep.
