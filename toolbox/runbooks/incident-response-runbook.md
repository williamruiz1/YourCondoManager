# Incident Response Runbook

**YourCondoManager (YCM)**
**Effective Date:** May 25, 2026
**Version:** 2.0
**Owner:** yourcondomanagement@gmail.com

---

## 1. Purpose

This runbook defines how YourCondoManager (YCM) responds to suspected or confirmed security incidents. It establishes the steps, owners, decision points, and external notification obligations that govern YCM's incident response (IR) program.

It applies to any event that:

- Compromises (or may compromise) the confidentiality, integrity, or availability of YCM systems or data
- Involves unauthorized access to HOA, owner, tenant, or vendor data; financial data; or administrative interfaces
- Involves theft, loss, or compromise of credentials, secrets, or API tokens
- Triggers a regulatory or contractual notification obligation (Plaid, Stripe, Google, data protection authorities, affected boards / owners / tenants)
- Breaks the **association-isolation invariant** — the most-load-bearing security promise of the platform

---

## 2. Incident Severity Classification

| Severity | Definition | YCM-Specific Examples |
|---|---|---|
| **SEV-1 (Critical)** | Active or confirmed breach of user data, financial data, or production credentials; cross-association data exposure; service-wide outage | Plaid access-token leak; Stripe webhook secret compromise; cross-association data exposure (one association seeing another's data); SQL injection exfiltrating association/owner data; HOA Connect-account misrouting (one HOA receiving another's funds); database unavailable |
| **SEV-2 (High)** | Strong indicator of compromise without confirmed exfiltration; partial service degradation; admin-level unauthorized access; cross-role exposure within an association | Suspicious admin login from unfamiliar geography; one owner briefly able to view another owner's ledger via a fixed bug; vendor briefly able to see board package; failed authentication spikes; Plaid token decryption failures clustering |
| **SEV-3 (Medium)** | Vulnerability with potential for impact but no active exploitation; isolated user-level issue | High-severity dependency CVE without active exploit; one user reporting unexpected logout; one association reporting a missing reconciliation match |
| **SEV-4 (Low)** | Best-practice gap, hardening opportunity, low-impact bug | Informational scanner findings; rate-limit gap on a non-sensitive endpoint |

**Default escalation rule:** when in doubt, classify higher. Downgrades happen after evidence; upgrades after impact.

---

## 3. Response Phases

### 3.1 Detection

Incidents are detected via:

- Automated alerts (application error monitoring at the Fly logs layer; GitHub Dependabot; npm audit in CI)
- Manual reports from users (security@yourcondomanager.org — routes to yourcondomanagement@gmail.com)
- Manual reports from researchers (Responsible Disclosure channel per Vulnerability Management Program §6)
- Partner notifications (Plaid, Stripe, Google) — security email feeds
- Internal observation during code review, audit, or normal operations

Anyone who suspects an incident **initiates this runbook immediately** rather than waiting for confirmation.

### 3.2 Containment (within 1 hour for SEV-1/SEV-2)

Goals: stop further damage, preserve evidence.

| Action | When |
|---|---|
| Revoke all suspected-compromised credentials (Fly secrets rotation via `flyctl secrets set -a yourcondomanager`) | Always for credential incidents |
| Disable affected admin / portal users via admin dashboard | When a user account is the vector |
| Revoke active sessions for affected users (rotate `SESSION_SECRET` if widespread) | When session compromise suspected |
| Call Plaid `/item/remove` on affected `bank_connections` rows | Plaid token compromise |
| Rotate `PLAID_TOKEN_ENCRYPTION_KEY` and re-encrypt all `bank_connections.access_token_encrypted` rows | Encryption-key compromise (note: re-encryption is a code path that must be exercised — see §5.6) |
| Disable Stripe webhook endpoint or rotate `PLATFORM_STRIPE_WEBHOOK_SECRET` | Stripe webhook compromise |
| Pause Stripe Connect onboarding (`/connect/onboard` route to 503) | Stripe Connect onboarding-flow vulnerability |
| Take affected API endpoint offline (route to 503) | Active cross-association or cross-role exposure |
| Block traffic at Fly.io network layer (`flyctl ips remove` for emergency isolation) | Service-wide compromise |
| Take a database snapshot before remediation | Preserve forensic state |

**Do NOT delete logs, code, or database records during containment.** Evidence preservation outweighs cleanup.

### 3.3 Assessment (within 4 hours for SEV-1)

Establish:

1. **Scope** — which associations affected, which roles, which data tables, what time window
2. **Root cause** — vulnerability exploited, misconfiguration, leaked credential, insider, partner
3. **Data exposure** — what was accessible vs. what was confirmed accessed/exfiltrated
4. **Persistence** — does the attacker still have access; are there backdoors
5. **Isolation impact** — was the `associationId` filter bypassed? on which endpoints?

Evidence sources:

- Application logs (`flyctl logs -a yourcondomanager`)
- Fly.io machine event history
- GitHub audit log (`gh api /user/audit-log` or repo audit logs)
- Database query logs (Neon dashboard)
- Stripe Dashboard events / Plaid Dashboard activity log
- Application audit-log table (admin actions, role changes)
- Browser console reports from affected users

### 3.4 Notification

| Audience | Trigger | SLA | Channel |
|---|---|---|---|
| **Plaid** | Any incident involving Plaid access tokens, Plaid-connected accounts, or data retrieved from Plaid | **Immediate** upon confirmation | Plaid Dashboard → Compliance → Security incident; backup email security@plaid.com |
| **Stripe** | Any incident involving Stripe API keys, webhook secrets, Stripe Connect account integrity, or payment data | **Immediate** | Stripe Dashboard → Support → Security incident |
| **Affected boards** | Confirmed breach involving association governance or financial data | **Within 72 hours** of confirmation | Email to board contact + in-app banner; phone call for SEV-1 |
| **Affected owners / tenants** | Confirmed breach involving their personal or financial data | **Within 72 hours** of confirmation (GDPR/CCPA-aligned) | Email to account address; in-app banner |
| **All users** | Service-wide breach | **Within 72 hours** | Email + status page + in-app banner |
| **Google (if OAuth compromised)** | OAuth token theft or misuse | **Immediate** | Google Cloud Console → Support |
| **State / federal regulators** | Per applicable breach-notification law (varies by state and data type) | Varies (often 30–60 days; some states require 24h–72h) | Per regulation |
| **Press / public** | At founder discretion after legal review; required for SEV-1 with broad user impact | After user notification complete | Coordinated statement |

**Notification content (minimum):**

- What happened (in plain language)
- What data was involved (be specific about which association(s) and which roles)
- What we have done to contain
- What the user should do (password reset, bank monitoring, governance review for boards, etc.)
- How to contact us for questions

### 3.5 Remediation

- Patch the root cause
- Rotate all credentials that were in the blast radius (even if not confirmed compromised)
- Add detection for the same vector (test or monitor)
- For association-isolation findings: add a regression test asserting the `associationId` filter on the affected endpoint
- For role-isolation findings: add a regression test asserting the role check on the affected endpoint
- Verify fix by re-running the original exploit / PoC against the patched system

**Deploy gate:** SEV-1 and SEV-2 remediations require a second reviewer (founder or designated security-focused reviewer) before merge, even in an emergency. The expedited reviewer focuses solely on the fix, not full PR review.

### 3.6 Recovery

- Restore service if it was degraded or taken offline
- Monitor for recurrence (24–72 hours of heightened attention depending on severity)
- Restore from backup ONLY if database integrity is compromised; otherwise patch forward
- Communicate to affected boards / owners when service is restored

### 3.7 Post-Incident Review (within 7 days of SEV-1/SEV-2 closure)

Document in a Post-Incident Report committed to `docs/handoffs/INCIDENT-YYYY-MM-DD-{slug}.md`. Required sections:

1. **Timeline** — minute-by-minute log from detection through recovery
2. **Root cause** — technical + organizational (what made the vulnerability possible)
3. **Impact** — confirmed data exposure; association count affected; owner / tenant / vendor count affected; financial impact
4. **What worked** — controls that detected, contained, or limited the incident
5. **What didn't** — gaps in detection, containment speed, communication
6. **Action items** — concrete fixes with owner and target date; each filed as a GitHub Issue
7. **External communications log** — copies of notifications sent to Plaid, Stripe, boards, owners, regulators

Reviews are blameless — focus on systems and processes, not individual decisions made under pressure.

---

## 4. Roles and Responsibilities

For a small team (currently solo + YCM), one person fills multiple roles. The role-assignments below establish responsibility, not headcount.

| Role | Responsibilities | Default Assignee |
|---|---|---|
| **Incident Commander** | Coordinates response; makes containment / scope / notification decisions; owns the timeline | William |
| **Technical Lead** | Investigates, executes containment, ships remediation | William |
| **Communications Lead** | Drafts and sends external notifications (boards, owners, Plaid, Stripe, regulators) | William |
| **Scribe** | Maintains the running timeline doc during the incident | William (auto: doc is updated as actions taken) |

When team grows, these split to multiple people. The Incident Commander role MUST be filled by a single person at any given time; ambiguity here costs response speed.

---

## 5. Playbooks (Common Scenarios)

### 5.1 Suspected leaked API key / secret in source control

1. **Rotate immediately** — `flyctl secrets set NAME=new-value -a yourcondomanager` for the affected secret
2. **Identify when committed** — `git log -p -S "secret-fragment"` to find the commit
3. **Revoke the leaked value** at the source (Stripe Dashboard → Developers → API Keys → revoke; Plaid Dashboard → Team Settings → Keys → regenerate; Google Cloud Console → IAM → rotate)
4. **Rewrite history** if the leak is on `main` and recent — coordinate force-push, notify any clones; otherwise document the leak in the post-incident report (rewriting old history is destructive and often not worth it)
5. **Audit for misuse** — check provider activity logs for the leaked-key timeframe
6. **Notify the provider** if their key was compromised (Plaid + Stripe both have security incident channels)
7. **Add CI check** to prevent the class of leak (e.g., gitleaks, trufflehog) if not already in place
8. **Treat as SEV-1** if the key has production access; SEV-2 if Sandbox-only

### 5.2 Cross-association data exposure (one association seeing another's data)

This is the most severe class of incident on the platform. It breaks the platform's primary security promise.

1. **Containment**: take the affected endpoint offline (route to 503) if exposure is ongoing
2. **Assess scope**: query logs for the buggy endpoint to enumerate affected association pairs and what data was rendered
3. **Patch**: fix the missing `associationId` filter; add a regression test asserting the filter is enforced
4. **Audit for systemic gap**: search the codebase for similar query patterns missing the `associationId` filter
5. **Notify affected boards** (both sides — the association who saw and the association whose data was seen)
6. **Document in post-incident review**
7. **Always SEV-1** per Vulnerability Management Program §3 YCM-Specific Severity Escalations

### 5.3 Cross-role data exposure within an association (e.g., owner sees another owner's ledger)

1. **Containment**: take the affected endpoint offline if exposure is ongoing
2. **Assess scope**: enumerate affected owner pairs from logs
3. **Patch**: fix the missing role / scope check; add a regression test asserting the check
4. **Notify affected owners** (both sides)
5. **Document in post-incident review**
6. **SEV-2** by default; escalate to SEV-1 if financial data was exposed or if affecting many owners

### 5.4 Suspected unauthorized admin access

1. **Rotate** `SESSION_SECRET` to invalidate all admin sessions (forces re-auth)
2. **Audit `admin_users` table** for unexpected `role = 'platform-admin'` rows or unexpected entries
3. **Audit `PLATFORM_ADMIN_EMAILS` Fly secret** for tampering
4. **Review application audit log** (admin actions, role changes) for the suspect window
5. **Disable** the suspected admin account if not legitimate
6. **Check Google Workspace audit log** for OAuth grant anomalies
7. **SEV-1** until investigation rules out misuse

### 5.5 Plaid item compromise

1. **Revoke** the affected `bank_connections` row via `plaidClient.itemRemove({ access_token })`
2. **Mark** the row `status = 'revoked'` and clear `access_token_encrypted`
3. **Notify the affected board (association-side) or owner (owner-side)** to reconnect through a fresh Plaid Link flow
4. **Notify Plaid** via the Plaid Dashboard if the cause was a YCM vulnerability (not bank-side)
5. **SEV-1** by default; downgrade only after evidence the token was never used

### 5.6 `PLAID_TOKEN_ENCRYPTION_KEY` compromise

This is a special case — compromise of the app-layer encryption key invalidates the at-rest protection of every Plaid access token.

1. **Generate a new key** (`openssl rand -hex 32`)
2. **Run the re-encryption migration**: a code path that reads each `bank_connections.access_token_encrypted` row, decrypts with the old key, re-encrypts with the new key, and writes back. This path **must be exercised before key rotation is invoked** — if it doesn't exist as a runnable script, write it first, treating that work as part of the containment step.
3. **Set the new key**: `flyctl secrets set PLAID_TOKEN_ENCRYPTION_KEY=<new-hex> -a yourcondomanager`
4. **Deploy** so the new value takes effect
5. **Notify Plaid** of the rotation
6. **SEV-1**

### 5.7 Stripe webhook secret compromise

1. **Rotate** the webhook secret in the Stripe Dashboard (Developers → Webhooks → Roll secret)
2. **Update** `PLATFORM_STRIPE_WEBHOOK_SECRET` Fly secret immediately (`flyctl secrets set`)
3. **Audit** webhook event log for events received between leak time and rotation — anything suspicious gets a manual replay-validation
4. **Notify Stripe** if leak was from our side (not Stripe-side)

### 5.8 Stripe Connect account misrouting (one HOA receiving another HOA's funds)

This is a SEV-1 incident affecting the platform's financial integrity and likely triggering reversal flows.

1. **Containment**: pause Stripe Connect onboarding (`/connect/onboard` → 503) and pause charge creation
2. **Identify** affected charges: scope by association pairs (intended HOA vs. routed HOA) and time window
3. **Reverse / refund**: coordinate refunds with Stripe Support; route funds to the correct HOA
4. **Patch**: fix the Connect-account-selection bug; add a regression test asserting the charge's `on_behalf_of` Connect account matches the assessment's association
5. **Notify** both HOA boards: the one that incorrectly received funds AND the one that didn't
6. **Notify Stripe** via the Stripe Dashboard security incident channel
7. **SEV-1**

### 5.9 Service-wide outage (database down, app crashed, network)

This runbook applies to outages caused by suspected security events (e.g., DoS, exploitation). Routine outages follow standard ops procedure.

If the outage may be security-driven:

1. **Containment**: block suspicious traffic at Fly.io edge before restoring service
2. **Restore from last known good** (Neon Postgres backup; 7-day rolling retention)
3. **Investigate root cause before re-opening to full traffic**

---

## 6. Tooling & References

- **Production console:** Fly.io Dashboard (`https://fly.io/dashboard/yourcondomanager`)
- **Database:** Neon Console (linked from Fly Postgres section)
- **Plaid Dashboard:** `https://dashboard.plaid.com`
- **Stripe Dashboard:** `https://dashboard.stripe.com`
- **Cloudflare Dashboard:** `https://dash.cloudflare.com` (DNS + email routing for `yourcondomanager.org`)
- **GitHub repo:** `williamruiz1/YourCondoManager`
- **Secret rotation:** `flyctl secrets set KEY=value -a yourcondomanager` then `flyctl deploy -a yourcondomanager`
- **Logs:** `flyctl logs -a yourcondomanager` (live), Fly Dashboard → Monitoring (historical)

Related policies:

- [Information Security Policy](../../docs/policies/information-security-policy-v1.md)
- [Privacy Policy](../../docs/policies/privacy-policy-v1.md)
- [Vulnerability Management Program](../../docs/policies/vulnerability-management-program-v1.md)
- [Data Retention Policy](../../docs/policies/data-retention-policy-v1.md)
- [Subprocessor List](../../docs/policies/subprocessor-list-v1.md)

---

## 7. Review and Testing

- **Annual full-runbook walkthrough** as part of the Security Compliance review
- **Quarterly tabletop exercise** — pick one scenario from §5 and walk the response in writing without actually executing
- **After every SEV-1 or SEV-2 incident**: review whether the runbook accurately reflected what was needed; amend as needed within 30 days of closure

---

**Version history:**

- **v2.0 (2026-05-25):** HOA-specific honest-claims rewrite per founder-os#2469. Reframed scope to "association-isolation invariant" as the primary security promise. Updated all Fly app references from `plinthkeep` to `yourcondomanager`. Updated containment table for live `bank_connections` schema (not `plaid_items`). Added §5.3 cross-role-within-association playbook. Added §5.6 `PLAID_TOKEN_ENCRYPTION_KEY` compromise playbook (specific to the live deployed app-layer encryption). Added §5.8 Stripe Connect misrouting playbook (specific to live HOA-as-merchant model). §3.4 notification matrix expanded with board-specific notification path.
- v1.0 (2026-05-20): initial DRAFT derived from Plinthkeep skeleton; landed in PR #168 with DRAFT banner pending Phase 1 honest-claims pass.
