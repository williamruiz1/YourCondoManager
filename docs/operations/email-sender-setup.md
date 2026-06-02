# Email Sender Setup — noreply@yourcondomanager.org

**Goal:** send all system emails from `noreply@yourcondomanager.org` with proper SPF/DKIM
authentication so they pass spam filters and land in inboxes.

**Why this matters:** sending from `noreply@yourcondomanager.org` via Gmail SMTP will **fail
SPF/DKIM** — Gmail is not authorised to send on behalf of `yourcondomanager.org`.  The fix is
to route through a provider that can authenticate the domain.

---

## Recommended path: Resend (one-time setup, ~10 min)

Resend is a transactional email API that handles domain verification, DKIM signing, and
SPF automatically.  The codebase already has the Resend client wired (`server/email/send.ts`
defaults to `EMAIL_PROVIDER=resend`).

### Step 1 — Create a Resend account and verify the domain (William-action)

1. Go to <https://resend.com> and sign in (or create a free account).
2. In the Resend dashboard → **Domains** → **Add Domain** → enter `yourcondomanager.org`.
3. Resend will show you the DNS records to add (see §DNS records below for the exact shape).
4. Add those records to your DNS registrar (GoDaddy, Namecheap, Cloudflare, etc.).
5. Click **Verify** in Resend.  Verification usually takes <5 min once DNS propagates.

### Step 2 — Generate a Resend API key (William-action)

1. In Resend dashboard → **API Keys** → **Create API Key**.
2. Give it a name (e.g., `ycm-production`), permission: **Full access** (or **Sending access**).
3. Copy the key — it starts with `re_live_`.
4. Set it in Fly.io secrets (see §Deploy below).  **Never commit this value.**

### Step 3 — Set env vars on Fly.io (William-action)

```bash
fly secrets set \
  EMAIL_PROVIDER=resend \
  RESEND_API_KEY=re_live_YOUR_KEY_HERE \
  EMAIL_FROM="YourCondoManager <noreply@yourcondomanager.org>" \
  EMAIL_FROM_ADDRESS=noreply@yourcondomanager.org \
  EMAIL_FROM_NAME=YourCondoManager \
  EMAIL_REPLY_TO=contact@yourcondomanager.org \
  --app YOUR_FLY_APP_NAME
```

After setting secrets, restart the app:

```bash
fly deploy --app YOUR_FLY_APP_NAME
```

---

## DNS records to add

Add these at your DNS registrar for `yourcondomanager.org`.  Resend's dashboard will show the
exact values when you add the domain — copy them verbatim.  The records below show the
**shape**; the DKIM token (`XXXXXXXX`) is unique to your Resend account.

| Type  | Name (host)                              | Value                                              | TTL   |
|-------|------------------------------------------|----------------------------------------------------|-------|
| TXT   | `yourcondomanager.org`                   | `v=spf1 include:amazonses.com ~all`                | 3600  |
| CNAME | `resend._domainkey.yourcondomanager.org` | `resend._domainkey.XXXXXXXX.resend.com.`           | 3600  |
| TXT   | `_dmarc.yourcondomanager.org`            | `v=DMARC1; p=quarantine; rua=mailto:dmarc@yourcondomanager.org` | 3600 |

> **Note:** Resend generates the actual CNAME value for your account.  Use the value from the
> Resend dashboard, not the placeholder above.

### SPF

The SPF record authorises Resend's sending infrastructure (Amazon SES) to send on behalf of
`yourcondomanager.org`:

```
v=spf1 include:amazonses.com ~all
```

If you already have an SPF record for another provider, merge the `include:` — e.g.:

```
v=spf1 include:_spf.google.com include:amazonses.com ~all
```

### DKIM

Resend provides a CNAME record that points to their DKIM signing key.  Add the CNAME shown in
your Resend dashboard.  Shape:

```
resend._domainkey.yourcondomanager.org  CNAME  resend._domainkey.<token>.resend.com.
```

### DMARC

DMARC tells receiving servers what to do with messages that fail SPF/DKIM.  A permissive
starting policy:

```
v=DMARC1; p=quarantine; rua=mailto:dmarc@yourcondomanager.org
```

Change `p=quarantine` to `p=reject` once you have confirmed deliverability is clean.

---

## Verification checklist (after DNS propagates)

Run this from any machine with `dig` or `nslookup`:

```bash
# SPF
dig TXT yourcondomanager.org | grep spf

# DKIM
dig CNAME resend._domainkey.yourcondomanager.org

# DMARC
dig TXT _dmarc.yourcondomanager.org
```

All three should return records.  Then test a real send via the Resend dashboard or the YCM
admin → Email settings → **Verify connection**.

---

## Alternative path: Google Workspace "Send mail as"

If `yourcondomanager.org` is managed by Google Workspace (G Suite), you can configure Gmail
to send as `noreply@yourcondomanager.org` without a separate email provider:

1. In Google Workspace Admin → Gmail → Default routing, add a sending domain alias.
2. In the Gmail account settings → Accounts → **Add another email address** → enter
   `noreply@yourcondomanager.org`.
3. Google will send a verification email; confirm it.
4. Keep `SMTP_HOST=smtp.gmail.com`, `SMTP_USER=<workspace-account>`,
   `EMAIL_FROM_ADDRESS=noreply@yourcondomanager.org`.

**Caveat:** This requires the domain to be on Google Workspace.  If it is not, use Resend.

---

## Local development

For local development, point SMTP at Mailpit or Mailtrap:

```bash
# Mailpit (runs locally on port 1025)
SMTP_HOST=localhost
SMTP_PORT=1025
SMTP_USER=
SMTP_PASS=
EMAIL_FROM_ADDRESS=noreply@yourcondomanager.org
EMAIL_PROVIDER=smtp
```

No DNS records needed for local sends — Mailpit captures them without delivering.

---

## Code changes (already landed in this PR)

| File | Change |
|------|--------|
| `server/email-provider.ts` | `fromAddress` defaults to `noreply@yourcondomanager.org` when neither `EMAIL_FROM_ADDRESS` nor the legacy Gmail env vars are set. |
| `server/email/send.ts` | No change needed — already reads `EMAIL_FROM` and defaults to `YourCondoManager <noreply@yourcondomanager.org>`. |
| `.env.example` | Added `EMAIL_PROVIDER`, `RESEND_API_KEY`, `EMAIL_FROM`, and updated `EMAIL_FROM_ADDRESS` / `EMAIL_REPLY_TO` to the real domain. |
| `docs/operations/email-sender-setup.md` | This file. |

Both send paths (`server/email/send.ts` for Resend and `server/email-provider.ts` for SMTP)
are env-driven.  No from-address is hardcoded in business logic.

---

## William-actions summary

| # | Action | Where |
|---|--------|-------|
| 1 | Create/log in to Resend, add domain `yourcondomanager.org`, get DNS records | resend.com dashboard |
| 2 | Add SPF, DKIM CNAME, DMARC records at DNS registrar | DNS registrar |
| 3 | Create Resend API key (`re_live_...`) | resend.com dashboard |
| 4 | Set `RESEND_API_KEY` + other email secrets on Fly.io | `fly secrets set ...` |
| 5 | Deploy (`fly deploy`) and verify with a test send | CLI / YCM admin panel |
