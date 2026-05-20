> **⚠️ STATUS: DRAFT — NOT YET PARTNER-READY**
>
> This document was derived from PlinthKeep's canonical policy (PR #105) via placeholder substitution. Plinthkeep's domain is single-family-rental; YourCondoManager's domain is HOA management. The high-level structure transfers but **role taxonomy** (HOA boards / owners / occupancy-typed tenants / vendors / platform admins) and **feature claims** (HOA assessments, Stripe Connect Standard for HOA-as-merchant, Plaid bank-feed reconciliation, multi-tenant association isolation) need a YCM-specific honest-claims rewrite per founder-os#1783 Phase 1 follow-on.
>
> The fully customized YCM-specific version is the **subprocessor-list-v1.md** file in this directory — that one is partner-questionnaire-ready and reflects YCM's actual stack as of 2026-05-20. The other policies follow once the Phase 1 honest-claims pass lands.
>
> ---

# Incident Response Runbook

**YourCondoManager (YCM)**
**Effective Date:** May 20, 2026
**Version:** 1.0
**Owner:** yourcondomanagement@gmail.com

---

## 1. Purpose

This runbook defines how YourCondoManager (YCM) responds to suspected or confirmed security incidents. It establishes the steps, owners, decision points, and external notification obligations that govern YourCondoManager (YCM)'s incident response (IR) program.

It applies to any event that:

- Compromises (or may compromise) the confidentiality, integrity, or availability of YourCondoManager (YCM) systems or data
- Involves unauthorized access to user data, financial data, or administrative interfaces
- Involves theft, loss, or compromise of credentials, secrets, or API tokens
- Triggers a regulatory or contractual notification obligation (Plaid, Stripe, payment processors, data protection authorities, affected users)

---

## 2. Incident Severity Classification

| Severity             | Definition                                                                                                                          | Examples                                                                                                                                       |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| **SEV-1 (Critical)** | Active or confirmed breach of user data, financial data, or production credentials; cross-tenant data exposure; service-wide outage | Plaid access token leak; SQL injection exfiltrating tenant data; Stripe webhook secret compromise; database unavailable                        |
| **SEV-2 (High)**     | Strong indicator of compromise without confirmed exfiltration; partial service degradation; admin-level unauthorized access         | Suspicious admin login from unfamiliar geography; one tenant briefly able to view another's data via a fixed bug; failed authentication spikes |
| **SEV-3 (Medium)**   | Vulnerability with potential for impact but no active exploitation; isolated user-level issue                                       | High-severity dependency CVE without active exploit; one user reporting unexpected logout                                                      |
| **SEV-4 (Low)**      | Best-practice gap, hardening opportunity, low-impact bug                                                                            | Informational scanner findings; rate-limit gap on a non-sensitive endpoint                                                                     |

**Default escalation rule:** when in doubt, classify higher. Downgrades happen after evidence; upgrades after impact.

---

## 3. Response Phases

### 3.1 Detection

Incidents are detected via:

- Automated alerts (application error monitoring, Fly.io infrastructure alerts, GitHub Dependabot, npm audit in CI)
- Manual reports from users (security@yourcondomanager.org — routes to yourcondomanagement@gmail.com)
- Manual reports from researchers (Responsible Disclosure channel per Vulnerability Management Program §6)
- Partner notifications (Plaid, Stripe, Google) — security email feeds
- Internal observation during code review, audit, or normal operations

Anyone who suspects an incident **initiates this runbook immediately** rather than waiting for confirmation.

### 3.2 Containment (within 1 hour for SEV-1/SEV-2)

Goals: stop further damage, preserve evidence.

| Action                                                                                       | When                              |
| -------------------------------------------------------------------------------------------- | --------------------------------- |
| Revoke all suspected-compromised credentials (Fly secrets rotation via `flyctl secrets set`) | Always for credential incidents   |
| Disable affected user accounts via admin dashboard                                           | When user account is the vector   |
| Revoke active sessions for affected users (rotate `SESSION_SECRET` if widespread)            | When session compromise suspected |
| Call Plaid `/item/remove` on affected items                                                  | Plaid token compromise            |
| Disable Stripe webhook endpoint or rotate webhook secret                                     | Stripe webhook compromise         |
| Block traffic at Fly.io network layer (`flyctl ips remove` for emergency isolation)          | Service-wide compromise           |
| Take a database snapshot before remediation                                                  | Preserve forensic state           |

**Do NOT delete logs, code, or database records during containment.** Evidence preservation outweighs cleanup.

### 3.3 Assessment (within 4 hours for SEV-1)

Establish:

1. **Scope** — what systems, what data, what users, what time window
2. **Root cause** — vulnerability exploited, misconfiguration, leaked credential, insider, partner
3. **Data exposure** — what was accessible vs. what was confirmed accessed/exfiltrated
4. **Persistence** — does the attacker still have access; are there backdoors

Evidence sources:

- Application logs (`flyctl logs -a plinthkeep`)
- Fly.io machine event history
- GitHub audit log (`gh api /user/audit-log` or repo audit logs)
- Database query logs (Neon dashboard)
- Stripe Dashboard events / Plaid Dashboard activity log
- Browser console reports from affected users

### 3.4 Notification

| Audience                          | Trigger                                                                                            | SLA                                                     | Channel                                                                           |
| --------------------------------- | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------- | --------------------------------------------------------------------------------- |
| **Plaid**                         | Any incident involving Plaid access tokens, Plaid-connected accounts, or data retrieved from Plaid | **Immediate** upon confirmation                         | Plaid Dashboard → Compliance → Security incident; backup email security@plaid.com |
| **Stripe**                        | Any incident involving Stripe API keys, webhook secrets, or payment data                           | **Immediate**                                           | Stripe Dashboard → Support → Security incident                                    |
| **Affected users**                | Confirmed breach involving their personal or financial data                                        | **Within 72 hours** of confirmation (GDPR/CCPA-aligned) | Email to account address; in-app banner                                           |
| **All users**                     | Service-wide breach                                                                                | **Within 72 hours**                                     | Email + status page + in-app banner                                               |
| **Google (if OAuth compromised)** | OAuth token theft or misuse                                                                        | **Immediate**                                           | Google Cloud Console → Support                                                    |
| **State / federal regulators**    | Per applicable breach-notification law (varies by state and data type)                             | Varies (often 30–60 days; some states require 24h–72h)  | Per regulation                                                                    |
| **Press / public**                | At founder discretion after legal review; required for SEV-1 with broad user impact                | After user notification complete                        | Coordinated statement                                                             |

**Notification content (minimum):**

- What happened (in plain language)
- What data was involved
- What we have done to contain
- What the user should do (password reset, bank monitoring, etc.)
- How to contact us for questions

### 3.5 Remediation

- Patch the root cause
- Rotate all credentials that were in the blast radius (even if not confirmed compromised)
- Add detection for the same vector (test or monitor)
- Verify fix by re-running the original exploit/PoC against the patched system

**Deploy gate:** SEV-1 and SEV-2 remediations require a second reviewer (founder or designated security-focused reviewer) before merge, even in an emergency. The expedited reviewer focuses solely on the fix, not full PR review.

### 3.6 Recovery

- Restore service if it was degraded or taken offline
- Monitor for recurrence (24–72 hours of heightened attention depending on severity)
- Restore from backup ONLY if database integrity is compromised; otherwise patch forward

### 3.7 Post-Incident Review (within 7 days of SEV-1/SEV-2 closure)

Document in a Post-Incident Report committed to `docs/handoffs/INCIDENT-YYYY-MM-DD-{slug}.md`. Required sections:

1. **Timeline** — minute-by-minute log from detection through recovery
2. **Root cause** — technical + organizational (what made the vulnerability possible)
3. **Impact** — confirmed data exposure; user count affected; financial impact
4. **What worked** — controls that detected, contained, or limited the incident
5. **What didn't** — gaps in detection, containment speed, communication
6. **Action items** — concrete fixes with owner and target date; each filed as a GitHub Issue
7. **External communications log** — copies of notifications sent

Reviews are blameless — focus on systems and processes, not individual decisions made under pressure.

---

## 4. Roles and Responsibilities

For a small team (currently solo + YourCondoManager (YCM)), one person fills multiple roles. The role-assignments below establish responsibility, not headcount.

| Role                    | Responsibilities                                                                            | Default Assignee                                |
| ----------------------- | ------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| **Incident Commander**  | Coordinates response; makes containment / scope / notification decisions; owns the timeline | William                                         |
| **Technical Lead**      | Investigates, executes containment, ships remediation                                       | William                                         |
| **Communications Lead** | Drafts and sends external notifications (users, Plaid, Stripe, regulators)                  | William                                         |
| **Scribe**              | Maintains the running timeline doc during the incident                                      | William (auto: doc is updated as actions taken) |

When team grows, these split to multiple people. The Incident Commander role MUST be filled by a single person at any given time; ambiguity here costs response speed.

---

## 5. Playbooks (Common Scenarios)

### 5.1 Suspected leaked API key / secret in source control

1. **Rotate immediately** — `flyctl secrets set NAME=new-value -a plinthkeep` for the affected secret
2. **Identify when committed** — `git log -p -S "secret-fragment"` to find the commit
3. **Revoke the leaked value** at the source (Stripe Dashboard → Developers → API Keys → revoke; Plaid Dashboard → Team Settings → Keys → regenerate; Google Cloud Console → IAM → rotate)
4. **Rewrite history** if the leak is on `main` and recent — coordinate force-push, notify any clones; otherwise document the leak in the post-incident report (rewriting old history is destructive and often not worth it)
5. **Audit for misuse** — check provider activity logs for the leaked-key timeframe
6. **Notify the provider** if their key was compromised (Plaid + Stripe both have security incident channels)
7. **Add CI check** to prevent the class of leak (e.g., gitleaks, trufflehog) if not already in place
8. **Treat as SEV-1** if the key has production access; SEV-2 if sandbox-only

### 5.2 Cross-tenant data exposure (one user seeing another's data)

1. **Containment**: take the affected endpoint offline (route to 503) if exposure is ongoing
2. **Assess scope**: query logs for the buggy endpoint to enumerate affected user pairs
3. **Patch**: fix the missing tenant-isolation check; add a regression test
4. **Notify affected users** (both sides — the user who saw and the user whose data was seen)
5. **Document in post-incident review**
6. **Always SEV-1** per Vulnerability Management Program §3 YourCondoManager (YCM)-Specific Severity Escalations

### 5.3 Suspected unauthorized admin access

1. **Rotate** `SESSION_SECRET` to invalidate all admin sessions (forces re-auth)
2. **Audit `users` table** for unexpected `is_platform_admin = true` rows
3. **Review admin action audit log** (`audit_logs` table where actor was admin) for the suspect window
4. **Disable** the suspected admin account if not legitimate
5. **Check Google Workspace audit log** for OAuth grant anomalies
6. **SEV-1** until investigation rules out misuse

### 5.4 Plaid item compromise

1. **Revoke** the affected item via `plaidClient.itemRemove({ access_token })`
2. **Delete** the encrypted token from `plaid_items` table
3. **Notify the affected user** to reconnect through a fresh Plaid Link flow
4. **Notify Plaid** via the Plaid Dashboard if the cause was a YourCondoManager (YCM) vulnerability (not bank-side)
5. **SEV-1** by default; downgrade only after evidence the token was never used

### 5.5 Stripe webhook secret compromise

1. **Rotate** the webhook secret in the Stripe Dashboard (Developers → Webhooks → Roll secret)
2. **Update** `STRIPE_WEBHOOK_SECRET` Fly secret immediately (`flyctl secrets set`)
3. **Audit** `stripe_webhook_events` table for events received between leak time and rotation — anything suspicious gets a manual replay-validation
4. **Notify Stripe** if leak was from our side (not Stripe-side)

### 5.6 Service-wide outage (database down, app crashed, network)

This runbook applies to outages caused by suspected security events (e.g., DoS, exploitation). Routine outages follow `docs/runbooks/db-backup-and-restore.md` and standard ops procedure.

If the outage may be security-driven:

1. **Containment**: block suspicious traffic at Fly.io edge before restoring service
2. **Restore from last known good** (Fly Postgres backup; takes ~30 minutes for our database size)
3. **Investigate root cause before re-opening to full traffic**

---

## 6. Tooling & References

- **Production console:** Fly.io Dashboard (`https://fly.io/dashboard/plinthkeep`)
- **Database:** Neon Console (linked from Fly Postgres section)
- **Plaid Dashboard:** `https://dashboard.plaid.com`
- **Stripe Dashboard:** `https://dashboard.stripe.com`
- **GitHub repo:** `williamruiz1/plinthkeep`
- **Secret rotation:** `flyctl secrets set KEY=value -a plinthkeep` then `flyctl deploy -a plinthkeep`
- **Logs:** `flyctl logs -a plinthkeep` (live), Fly Dashboard → Monitoring (historical)

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

- v1.0 (2026-05-20): Initial runbook. Created to fulfill references from Information Security Policy §7 and Privacy Policy §7. Aligned to industry IR practice (NIST SP 800-61r2, SANS PICERL phases).
