> **⚠️ STATUS: DRAFT — NOT YET PARTNER-READY**
>
> This document was derived from PlinthKeep's canonical policy (PR #105) via placeholder substitution. Plinthkeep's domain is single-family-rental; YourCondoManager's domain is HOA management. The high-level structure transfers but **role taxonomy** (HOA boards / owners / occupancy-typed tenants / vendors / platform admins) and **feature claims** (HOA assessments, Stripe Connect Standard for HOA-as-merchant, Plaid bank-feed reconciliation, multi-tenant association isolation) need a YCM-specific honest-claims rewrite per founder-os#1783 Phase 1 follow-on.
>
> The fully customized YCM-specific version is the **subprocessor-list-v1.md** file in this directory — that one is partner-questionnaire-ready and reflects YCM's actual stack as of 2026-05-20. The other policies follow once the Phase 1 honest-claims pass lands.
>
> ---

# Data Retention and Disposal Policy

**YourCondoManager (YCM)**
**Effective Date:** May 20, 2026
**Version:** 1.2
**Owner:** yourcondomanagement@gmail.com

---

## 1. Purpose

This Data Retention and Disposal Policy governs how YourCondoManager (YCM) retains, manages, and disposes of data throughout its lifecycle. It ensures that:

- Data is retained for as long as needed to serve users and meet legal obligations
- Data is not retained longer than necessary, reducing privacy risk
- Data disposal is handled securely
- Users' rights to data deletion are respected within legal constraints

This policy applies to all data collected, processed, or stored by YourCondoManager (YCM), including data in application databases, file storage, backups, logs, and third-party systems.

---

## 2. Scope

This policy covers data held by YourCondoManager (YCM) on behalf of landlords, property managers, tenants, and vendors, including:

- Account and identity data
- Property, lease, and rental data
- Tenant personal information
- Financial data (rent payments, Plaid-connected accounts)
- Maintenance records
- Technical and operational data (logs, session data)

---

## 3. Retention Schedule

### 3.1 Account and Identity Data

| Data Type                                                     | Retention Period                                                                                                                                                  | Basis               |
| ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- |
| Account registration data (name, email, Google subject ID)    | Duration of active account + 30 days after deletion request                                                                                                       | Service delivery    |
| Google OAuth tokens                                           | Duration of session; revoked on logout                                                                                                                            | Security            |
| Session tokens (signed JWTs)                                  | Configurable `SESSION_TTL_DAYS` (default 7 days)                                                                                                                  | Security            |
| Authentication logs (OAuth callback success, JWT validation)  | 1 year                                                                                                                                                            | Security monitoring |
| OAuth callback failures and JWT validation failures           | 90 days                                                                                                                                                           | Fraud prevention    |
| Account deletion records (tombstone: user ID + deletion date) | 7 years — **planned**; not yet implemented as of policy v1.1 (users hard-deleted at day 31 of grace window with no tombstone preserved). See §Pending follow-ups. | Legal compliance    |

### 3.2 Property and Rental Data

| Data Type                                              | Retention Period                                   | Basis                               |
| ------------------------------------------------------ | -------------------------------------------------- | ----------------------------------- |
| Property listing data (address, units, configurations) | Duration of account; deleted with account deletion | Service delivery                    |
| Lease agreements                                       | 7 years after lease end date                       | Legal / tax compliance              |
| Rent payment records                                   | 7 years from payment date                          | Financial record requirements (IRS) |
| Late payment notices and rent demand records           | 7 years                                            | Legal compliance                    |
| Security deposit records                               | 7 years after deposit return                       | Legal compliance                    |
| Move-in / move-out inspection records                  | 7 years                                            | Legal compliance                    |
| Eviction records (if applicable)                       | 7 years                                            | Legal compliance                    |

### 3.3 Tenant Data

| Data Type                                       | Retention Period                                                          | Basis                                                         |
| ----------------------------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------- |
| Tenant application data (accepted applicants)   | Duration of tenancy + 1 year post-tenancy end                             | Business records                                              |
| Tenant application data (rejected applicants)   | 3 years from application date                                             | Fair Housing Act compliance                                   |
| Tenant contact information (name, email, phone) | Duration of tenancy + 1 year post-tenancy end, then anonymized or deleted | Privacy best practice                                         |
| Tenant addresses                                | Duration of tenancy + 1 year                                              | Business records                                              |
| Tenant payment history (amounts, dates, status) | 7 years from payment date                                                 | Financial records (anonymized: payee becomes "Former Tenant") |

**Anonymization after retention:** after the retention period for tenant PII ends, the record is anonymized: name, email, and phone number are replaced with anonymized identifiers. The financial and lease records (dates, amounts, property address) are retained for the financial record period separately.

### 3.4 Financial Data (Stripe billing — live; Plaid aggregation — Sandbox active, Production gated)

**Status as of v1.2 (2026-05-20):** Stripe Phase A live (PR #58 + #59). Plaid Phase 1 scaffolded with Sandbox active; production application submitted; feature flag OFF in production until app-layer token encryption ships.

| Data Type                                                             | Retention Period                                                 | Basis                              |
| --------------------------------------------------------------------- | ---------------------------------------------------------------- | ---------------------------------- |
| Stripe customer ID / subscription ID                                  | Duration of active subscription + 7 years                        | Financial records / tax compliance |
| Stripe webhook event log (`stripe_webhook_events`)                    | 90 days (replay-protection idempotency window) + 1 year archived | Audit + dispute resolution         |
| Stripe credit-pack purchase records                                   | 7 years from purchase                                            | Financial records / tax compliance |
| Plaid access tokens (DB at-rest + planned app-layer encryption)       | Active connection + 30 days after disconnection, then deleted    | Service delivery; Plaid compliance |
| Plaid item metadata (institution name, account names, masks)          | Duration of active connection + 30 days                          | Service delivery                   |
| Plaid transaction history (`plaid_transactions`)                      | 7 years from transaction date                                    | Tax / legal compliance             |
| Bank-account metadata (last 4 digits, account type — not credentials) | Duration of active connection + 30 days                          | Service delivery                   |
| Rent payment ledger records (manual or via future Stripe Connect)     | 7 years from transaction date                                    | Tax / legal compliance             |
| Refund records                                                        | 7 years                                                          | Financial records                  |
| Financial reports generated by the platform                           | 7 years if saved by user; 90 days if auto-generated              | Legal and tax compliance           |

**Note:** financial records required for IRS reporting or legal compliance are retained for the full statutory period regardless of account deletion requests. Users are notified of any data retained beyond their deletion request.

### 3.5 Maintenance Data

| Data Type                                           | Retention Period         | Basis            |
| --------------------------------------------------- | ------------------------ | ---------------- |
| Maintenance requests (description, status, dates)   | 5 years after resolution | Business records |
| Work orders assigned to vendors                     | 5 years after completion | Business records |
| Maintenance invoices and receipts                   | 7 years                  | Tax compliance   |
| Property photos submitted with maintenance requests | 5 years after resolution | Business records |
| Maintenance correspondence                          | 5 years after resolution | Business records |

### 3.6 Vendor Data

| Data Type                  | Retention Period                          | Basis               |
| -------------------------- | ----------------------------------------- | ------------------- |
| Vendor contact information | Duration of active relationship + 2 years | Business operations |
| Vendor work order history  | 5 years after last work order             | Business records    |

### 3.7 Technical and Operational Data

| Data Type                                      | Retention Period | Basis                 |
| ---------------------------------------------- | ---------------- | --------------------- |
| Application error logs                         | 90 days          | Debugging             |
| Access logs (web server)                       | 90 days          | Security monitoring   |
| Audit logs (admin actions, data access events) | 1 year           | Security / compliance |
| Database backups                               | 7 days (rolling) | Business continuity   |
| Analytics and usage data (anonymized)          | 2 years          | Product improvement   |

### 3.8 Communication Data

| Data Type                                         | Retention Period         | Basis              |
| ------------------------------------------------- | ------------------------ | ------------------ |
| Support emails and tickets                        | 3 years after resolution | Dispute resolution |
| In-app notifications                              | 90 days                  | Service delivery   |
| System-generated emails (receipts, confirmations) | 1 year                   | Audit trail        |

---

## 4. Data Deletion Procedures

### 4.1 User-Initiated Account Deletion

When a user requests account deletion:

1. **Acknowledgment:** confirm receipt within 5 business days
2. **Immediate actions:** revoke all Plaid access tokens for connected accounts; invalidate all active sessions
3. **Personal data deletion:** within 30 days, delete or anonymize all personal data not subject to mandatory retention
4. **Backup data:** database backups cycle on a 7-day rolling basis; deleted records naturally fall out within 7 days
5. **Confirmation:** send confirmation email when deletion is complete

**Data exempt from deletion requests (legally required retention):**

- Financial transaction records (7-year requirement)
- Lease agreement records (7-year requirement)
- Legal hold data
- Anonymized records that cannot be linked to the individual

**Special case — landlord account deletion:**

- Deleting a landlord account does not automatically delete tenant accounts. Tenant accounts have their own lifecycle.
- Tenant data associated with the landlord's properties is retained per the tenant data retention schedule above.
- William is notified when a landlord with active tenancies requests deletion.

### 4.2 Plaid Access Token Revocation

> **Status as of v1.2 (2026-05-20):** Plaid Phase 1 scaffolded with Sandbox active; production access submitted. Revocation flow below is implemented in `server/routes/plaid.ts` and exercised against Plaid Sandbox. The production `plaid-bank-aggregation` feature flag is OFF until app-layer token encryption ships.

Upon account deletion or user-initiated bank account disconnection:

1. Call Plaid's `/item/remove` endpoint to revoke the access token server-side at Plaid
2. Delete the access token from the `plaid_items` table
3. Delete associated transaction data beyond the required financial record retention window (financial records subject to 7-year tax retention are anonymized rather than deleted: bank-account masks and institution names are dropped, transaction amount/date/categorization is retained for tax compliance)

### 4.3 Automated Deletion (Scheduled Purges)

| Purge Job                  | Frequency | Data Targeted                                         |
| -------------------------- | --------- | ----------------------------------------------------- |
| Session cleanup            | Daily     | Expired sessions older than 24 hours                  |
| Log rotation               | Weekly    | Application error logs older than 90 days             |
| Expired token cleanup      | Daily     | Password reset tokens, expired OAuth state parameters |
| Soft-deleted account purge | Monthly   | Accounts soft-deleted more than 30 days ago           |
| Archive pruning            | Quarterly | Records beyond retention schedule                     |
| Tenant PII anonymization   | Quarterly | Tenant PII where tenancy ended > 1 year ago           |

---

## 5. Data Disposal Standards

### 5.1 Database Records

- Standard deletion: SQL DELETE or UPDATE (soft-delete followed by hard delete after 30 days)
- Anonymization: PII fields overwritten with anonymized placeholders; financial and date records preserved
- Database backups cycle on a 7-day rolling basis; deleted records are excluded from new backups

### 5.2 Plaid Access Tokens

- Plaid access tokens are deleted from the `plaid_items` table upon disconnection
- Current protection: Postgres at-rest AES-256 (Neon default). Once application-layer encryption keyed by `PLAID_TOKEN_ENCRYPTION_KEY` ships (gating the production feature flag), database-record deletion will render the token unrecoverable even if traces persist in backups.
- Backups are overwritten within 7 days regardless, naturally aging out deleted records

### 5.3 Development and Testing Environments

- Production data is never copied to development or testing environments without anonymization
- Anonymized data in development environments is subject to the same disposal standards upon environment teardown

---

## 6. Legal Holds

A legal hold suspends normal retention and deletion schedules for data relevant to litigation or regulatory investigations.

When a legal hold is initiated:

1. Scope documented (users, date ranges, data types)
2. Automated deletion processes suspended for covered data
3. Access to held data restricted and logged

Legal holds are released only when the matter is fully resolved. Upon release, normal schedules resume and data past retention period is deleted.

---

## 7. Third-Party Data Retention

| Provider      | Their Retention                                                                        | Our Obligation                                                                                                      |
| ------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Fly.io / Neon | Infrastructure data per their terms; database data controlled by us                    | Delete data within our schedules; Fly/Neon manage underlying storage media                                          |
| Stripe        | Per Stripe's privacy policy (transaction records typically 7 years for tax compliance) | We retain only Stripe identifiers + subscription state; payment-method data is Stripe-held                          |
| Plaid         | Per Plaid's privacy policy                                                             | Revoke access tokens via `/item/remove` upon disconnection; Plaid retains its own transaction data per their policy |
| Google        | Per Google's privacy policy for OAuth data                                             | Revoke OAuth tokens on account deletion                                                                             |
| Cloudflare    | Email routing logs per Cloudflare's terms                                              | Emails forwarded to operator mailbox; routing logs retained per Cloudflare schedule                                 |

---

## 8. Policy Review

This policy is reviewed annually as part of the Security Compliance Runbook annual review cycle, and after any significant changes to YourCondoManager (YCM)'s data model or regulatory environment.

Operational cadence is enforced by `.github/workflows/security-compliance-calendar.yml` which auto-files an Issue for each review. See `docs/policies/security-compliance-calendar-v1.md`.

Questions: yourcondomanagement@gmail.com

## §Pending follow-ups

These items are surfaced by the 2026-05-11 policy-vs-system audit (Issue #429 Stream 4) and represent gaps between policy text and current implementation. Each will be closed by a code change OR a future policy amendment:

- **Tombstone table for account deletion records (7-year retention).** Current `runDataRetentionCleanup` in `server/scheduled-tasks.ts` hard-deletes user rows at day 31 of the grace window without preserving a `(user_id, deletion_date)` tombstone. To honor the 7-year retention claim, a migration should add an `account_tombstones` table (or equivalent) and the cleanup task should INSERT into it before DELETE. Alternative: amend the retention table to drop the tombstone clause if 7-year retention isn't a business requirement pre-launch. — pending founder decision.

**Version history:**

- v1.2 (2026-05-20): reflects Stripe Phase A live (PR #58 + #59), Plaid Phase 1 scaffolded with Sandbox active + production submitted (PR #104); §3.4 financial-data table expanded with Stripe + Plaid v1 rows; §7 third-party table now lists Stripe, Neon, Cloudflare alongside existing providers; §4.2 + §5.2 reflect honest current encryption posture (DB-layer live; app-layer required before flag enable).
- v1.1 (2026-05-11): post-audit revisions (Issue #429 Stream 4) — re-scoped authentication-log rows for OAuth-only model; flagged tombstone clause as planned/not-yet-implemented; added §Pending follow-ups section.
- v1.0 (2026-05-10): initial policy
