# Data Retention and Disposal Policy

**YourCondoManager (YCM)**
**Effective Date:** May 25, 2026
**Version:** 2.0
**Owner:** yourcondomanagement@gmail.com

---

## 1. Purpose

This Data Retention and Disposal Policy governs how YourCondoManager (YCM) retains, manages, and disposes of data throughout its lifecycle. It ensures that:

- Data is retained for as long as needed to serve users, associations, and meet legal obligations
- Data is not retained longer than necessary, reducing privacy risk
- Data disposal is handled securely
- Users' rights to data deletion are respected within legal constraints

This policy applies to all data collected, processed, or stored by YCM, including data in application databases, file storage, backups, logs, and third-party systems.

---

## 2. Scope

This policy covers data held by YCM on behalf of HOA associations, board members, owners, tenants of owner-rented units, vendors, and YCM platform admins, including:

- Account and identity data
- Association governance and owner-roster data
- Unit, ownership, and occupancy data
- Financial data (assessment ledgers, Stripe payments, Plaid bank-feed reconciliation)
- Maintenance, work-order, and vendor records
- Board packages and community announcements
- Technical and operational data (logs, session data, email engagement)

---

## 3. Retention Schedule

### 3.1 Account and Identity Data

| Data Type | Retention Period | Basis |
|---|---|---|
| Admin user records (`admin_users`: name, email, Google subject ID, role) | Duration of active access + 30 days after deactivation | Service delivery |
| Portal access records (`portal_access`: owner / board-member invites, activations, sessions) | Duration of active portal access + 30 days after revocation | Service delivery |
| Google OAuth tokens | Duration of session; revoked on logout | Security |
| Server-side session records (express-session via `connect-pg-simple`) | Until `SESSION_MAX_AGE_MS` expiry; rotated when `SESSION_SECRET` is rotated | Security |
| Authentication logs (OAuth callback success, session creation) | 1 year | Security monitoring |
| OAuth callback failures and portal-activation failures | 90 days | Fraud prevention |

### 3.2 Association, Unit, and Ownership Data

| Data Type | Retention Period | Basis |
|---|---|---|
| Association records (`associations`: legal name, address, governing-document references, fiscal year) | Duration of association tenancy on the platform | Service delivery |
| Buildings + units (`buildings`, `units`) | Duration of association tenancy | Service delivery |
| Ownership records (`ownerships`: owner-to-unit mapping, ownership share, occupancy type) | Duration of ownership + 7 years after transfer of title | Legal / tax compliance |
| Unit change history (`unit_change_history`) | 7 years from each change | Audit trail / dispute resolution |
| Board roles (`board_roles`: president, treasurer, secretary, etc.) | Duration of board service + 7 years | Legal / governance audit |
| Onboarding submissions (`onboarding_submissions`, `onboarding_invites`) | 7 years from submission | Audit + governance |

### 3.3 Owner, Tenant, and Resident Data

| Data Type | Retention Period | Basis |
|---|---|---|
| Owner contact information (name, email, phone, mailing address) | Duration of ownership + 1 year after transfer of title, then anonymized | Privacy best practice |
| Tenant contact information (board- or owner-recorded for `TENANT`-occupancy units) | Duration of recorded tenancy + 1 year, then anonymized or deleted | Privacy best practice |
| Resident profile / preference data (`admin_user_preferences`) | Duration of active access | Service delivery |
| Maintenance requests submitted by owners or tenants | 5 years after resolution | Business records |
| Community-announcement read receipts (if recorded) | 1 year | Audit |

**Anonymization after retention:** after the retention period for owner / tenant PII ends, the record is anonymized: name, email, and phone number are replaced with anonymized identifiers. The financial and ownership records (dates, amounts, unit address) are retained for the financial / governance retention period separately.

### 3.4 Financial Data

**Status as of v2.0 (2026-05-25):** Stripe Connect Standard is live in production for HOA-as-merchant ACH; Stripe billing is live for YCM SaaS subscriptions. Plaid Sandbox is live for both association- and owner-side bank-feed reconciliation; application-layer Plaid token encryption is deployed (`PLAID_TOKEN_ENCRYPTION_KEY`). Plaid Production access is not yet provisioned.

| Data Type | Retention Period | Basis |
|---|---|---|
| Stripe customer ID / subscription ID (YCM SaaS billing) | Duration of active subscription + 7 years | Financial records / tax compliance |
| Stripe Connect account metadata (per-HOA sub-merchant records) | Duration of association tenancy + 7 years | Financial records / tax compliance |
| Stripe charge IDs, payment intent IDs, statement descriptors (assessment collection) | 7 years from charge date | Financial records / tax compliance |
| Stripe webhook event log | 90-day idempotency window + 1 year archived | Audit + dispute resolution |
| Plaid access tokens (`bank_connections.access_token_encrypted`) | Active connection + 30 days after disconnection, then deleted | Service delivery; Plaid compliance |
| Bank-connection metadata (`bank_connections`: institution name, provider_item_id, status) | Duration of active connection + 30 days | Service delivery |
| Bank-account metadata (`bank_accounts`: name, mask, type, subtype) | Duration of active connection + 30 days | Service delivery |
| Bank-feed transaction history (`bank_transactions`) | 7 years from transaction date | Tax / legal compliance |
| Owner ledger entries (`owner_ledger_entries`: charges, assessments, payments, late-fees, credits, adjustments) | 7 years from posting date | Financial records / tax compliance |
| Owner payment links (`owner_payment_links`) | 7 years from link creation | Audit + financial records |
| Assessment runs and rules (`assessment_*`) | 7 years from run | Governance / tax records |
| Refund records | 7 years | Financial records |
| Financial reports generated by the platform | 7 years if saved by user; 90 days if auto-generated | Legal and tax compliance |

**Note:** financial records required for IRS reporting or governance compliance are retained for the full statutory period regardless of account deletion requests. Users are notified of any data retained beyond their deletion request.

### 3.5 Maintenance and Vendor Data

| Data Type | Retention Period | Basis |
|---|---|---|
| Maintenance requests (description, status, dates) | 5 years after resolution | Business records |
| Work orders assigned to vendors | 5 years after completion | Business records |
| Vendor invoices (`vendor_invoices`) | 7 years | Tax compliance |
| Vendor contact information (`vendors`) | Duration of active relationship + 2 years | Business operations |
| Property/unit photos submitted with maintenance requests | 5 years after resolution | Business records |
| Maintenance correspondence | 5 years after resolution | Business records |
| Inspection records (`inspection_*`) | 7 years | Governance / audit |

### 3.6 Governance and Communication Data

| Data Type | Retention Period | Basis |
|---|---|---|
| Board packages (`board_packages`) | 7 years from distribution | Governance audit |
| Community announcements (`community_announcements`) | 5 years after publication | Governance audit |
| Clause records (`clause_records` — governance document fragments) | Duration of association tenancy + 7 years | Governance audit |
| Support emails and tickets | 3 years after resolution | Dispute resolution |
| In-app notifications | 90 days | Service delivery |
| System-generated transactional emails (`email_logs`, `email_events`) | 1 year | Audit trail + deliverability |

### 3.7 Technical and Operational Data

| Data Type | Retention Period | Basis |
|---|---|---|
| Application error logs | 90 days | Debugging |
| Access logs (web server) | 90 days | Security monitoring |
| Audit logs (admin actions, role-change events) | 1 year | Security / compliance |
| Database backups (Neon automated) | 7 days (rolling) | Business continuity |
| Analytics and usage data (anonymized) | 2 years | Product improvement |
| AI Assistant interaction telemetry (`ai_assistant_interactions`) | 2 years | Cost / quality review |

---

## 4. Data Deletion Procedures

### 4.1 User-Initiated Account Deletion

When a user requests account deletion:

1. **Acknowledgment:** confirm receipt within 5 business days
2. **Immediate actions:** revoke Plaid access tokens for connections owned by the user (call Plaid `/item/remove`, then mark `bank_connections` row as `revoked` and clear `access_token_encrypted`); invalidate all active sessions for the user
3. **Personal data deletion:** within 30 days, delete or anonymize all personal data not subject to mandatory retention
4. **Backup data:** database backups cycle on a 7-day rolling basis; deleted records naturally fall out within 7 days
5. **Confirmation:** send confirmation email when deletion is complete

**Data exempt from deletion requests (legally required retention):**

- Financial transaction records (7-year requirement)
- Ownership and unit-transfer records (7-year requirement post-transfer)
- Governance records subject to state HOA-record-keeping requirements
- Legal hold data
- Anonymized records that cannot be linked to the individual

**Special case — board-member account deletion:**

- Deleting a board member's individual YCM admin account does not delete the association. The association continues to exist; the board roster is updated to remove the departed member.
- Historical board-action audit-log entries authored by the departed member are retained per the audit-log retention schedule (1 year) with their attribution preserved.

**Special case — association deletion (board-initiated):**

- An association is removed from the platform when its board terminates the YCM subscription
- Owner records associated with the association are anonymized after the retention windows in §3.3
- Financial records associated with the association are retained for 7 years per §3.4 regardless of subscription termination
- Owners holding portal access tied solely to the deleted association have that portal access revoked

### 4.2 Plaid Access Token Revocation

> **Status as of v2.0 (2026-05-25):** Plaid Sandbox is live for both association- and owner-side flows. Application-layer encryption of access tokens is deployed (`PLAID_TOKEN_ENCRYPTION_KEY` in Fly secrets, wired into `bank_connections.access_token_encrypted`). Plaid Production access is not yet provisioned.

Upon account deletion, association termination, or user-initiated bank-account disconnection:

1. Call Plaid's `/item/remove` endpoint to revoke the access token server-side at Plaid
2. Update the `bank_connections` row: set `status = 'revoked'` and clear `access_token_encrypted`
3. Retain associated transaction data per the financial-record retention window (7 years); bank-account masks and institution names may be retained or dropped per the disposal procedure in §5.2

### 4.3 Stripe Connect Account Deactivation

When an HOA association leaves the platform:

1. The Stripe Connect sub-merchant account is left in a deactivated state on Stripe's side — YCM does not delete Connect accounts (Stripe retains them for their own compliance retention)
2. The link between the YCM `associations` record and the Stripe Connect account ID is cleared after the financial-record retention window expires
3. Historical charge IDs and statement descriptors are retained per §3.4

### 4.4 Automated Deletion (Scheduled Purges)

| Purge Job | Frequency | Data Targeted |
|---|---|---|
| Session cleanup | Daily | Expired sessions older than `SESSION_MAX_AGE_MS` |
| Log rotation | Weekly | Application error logs older than 90 days |
| Expired invite cleanup | Daily | Portal-access invites past `EXPIRED` state |
| Soft-deleted account purge | Monthly | Accounts soft-deleted more than 30 days ago |
| Archive pruning | Quarterly | Records beyond retention schedule |
| Owner / tenant PII anonymization | Quarterly | PII where ownership or tenancy ended > 1 year ago |
| Stripe webhook event archive | Monthly | Move events older than 90 days to archive tier |

---

## 5. Data Disposal Standards

### 5.1 Database Records

- Standard deletion: SQL `DELETE` or `UPDATE` (soft-delete followed by hard delete after 30 days)
- Anonymization: PII fields overwritten with anonymized placeholders; financial and date records preserved
- Database backups cycle on a 7-day rolling basis; deleted records are excluded from new backups

### 5.2 Plaid Access Tokens

- Plaid access tokens are stored in `bank_connections.access_token_encrypted` with application-layer AES-256 encryption (key `PLAID_TOKEN_ENCRYPTION_KEY` in Fly secrets) plus Postgres at-rest AES-256
- On disconnection, the encrypted column is cleared and the row's `status` is set to `revoked`
- Because the application-layer key is stored in Fly secrets (not in the database), clearing the encrypted column renders the token unrecoverable from any persisted backup — even if a backup contained an earlier copy of the row, the ciphertext is useless without the key
- Backups themselves cycle on a 7-day rolling basis

### 5.3 Stripe Data

- YCM does not hold bank-account or card numbers; Stripe holds them and disposes per their own retention policy
- YCM-side Stripe identifiers (charge IDs, payment intent IDs, Connect account IDs) are subject to the financial-record retention schedule in §3.4 and the deletion procedures in §4

### 5.4 Development and Testing Environments

- Production data is never copied to development or testing environments without anonymization
- Anonymized data in development environments is subject to the same disposal standards upon environment teardown
- Stripe test mode and Plaid Sandbox are used in development; these never touch real bank or card data

---

## 6. Legal Holds

A legal hold suspends normal retention and deletion schedules for data relevant to litigation or regulatory investigations. This is particularly relevant for HOA contexts where governance disputes, election challenges, or financial-irregularity claims may arise.

When a legal hold is initiated:

1. Scope documented (associations, users, date ranges, data types)
2. Automated deletion processes suspended for covered data
3. Access to held data restricted and logged

Legal holds are released only when the matter is fully resolved. Upon release, normal schedules resume and data past retention period is deleted.

---

## 7. Third-Party Data Retention

| Provider | Their Retention | Our Obligation |
|---|---|---|
| Fly.io / Neon | Infrastructure data per their terms; database data controlled by us | Delete data within our schedules; Fly/Neon manage underlying storage media |
| Stripe (Connect + billing) | Per Stripe's privacy policy (transaction records typically 7 years for tax compliance) | We retain only Stripe identifiers + subscription / Connect-account state; payment-method data is Stripe-held |
| Plaid | Per Plaid's privacy policy | Revoke access tokens via `/item/remove` upon disconnection; Plaid retains its own transaction data per their policy |
| Google | Per Google's privacy policy for OAuth data | Revoke OAuth tokens on account deletion |
| Cloudflare | DNS + email routing logs per Cloudflare's terms | Emails forwarded to operator mailbox; routing logs retained per Cloudflare schedule |
| Anthropic | Per Anthropic's privacy policy for API interactions | We retain per-interaction telemetry (token count, cost, success/failure) for 2 years; prompt content is not retained on our side beyond the active interaction window |

---

## 8. Policy Review

This policy is reviewed annually as part of the Security Compliance Calendar, and after any significant changes to YCM's data model or regulatory environment.

Operational cadence is enforced by `docs/policies/security-compliance-calendar-v1.md`.

Questions: yourcondomanagement@gmail.com

---

**Version history:**

- **v2.0 (2026-05-25):** HOA-specific honest-claims rewrite per founder-os#2469. Replaced landlord/tenant taxonomy with HOA roles (board / owners / tenants / vendors / admins). Renamed table references to the live schema: `bank_connections` / `bank_accounts` / `bank_transactions` (not `plaid_items` / `plaid_transactions`). §3.2 added association + unit + ownership tables. §3.4 reflects Stripe Connect Standard live + Plaid Sandbox-only state + deployed app-layer token encryption. §4.3 added Stripe Connect deactivation procedure. §5.2 reflects deployed encryption with key-in-Fly-secrets posture. §7 added Anthropic.
- v1.2 (2026-05-20): initial DRAFT derived from Plinthkeep skeleton; landed in PR #168 with DRAFT banner pending Phase 1 honest-claims pass.
